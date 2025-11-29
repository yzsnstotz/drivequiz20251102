#!/usr/bin/env python3
"""
完全使用 Python 创建 git 仓库，包括初始提交
不依赖 git 命令
"""
import os
import hashlib
import zlib
import subprocess
import sys
from datetime import datetime

def create_git_object(content, obj_type="blob"):
    """创建 git 对象"""
    header = f"{obj_type} {len(content)}\0".encode()
    data = header + content
    sha1 = hashlib.sha1(data).hexdigest()
    compressed = zlib.compress(data)
    
    # 创建对象文件
    obj_dir = os.path.join(".git", "objects", sha1[:2])
    os.makedirs(obj_dir, exist_ok=True)
    obj_file = os.path.join(obj_dir, sha1[2:])
    
    with open(obj_file, "wb") as f:
        f.write(compressed)
    
    return sha1

def create_tree(files_data):
    """创建 tree 对象"""
    tree_entries = []
    for mode, path, sha in files_data:
        path_parts = path.split("/")
        tree_entries.append((mode, path_parts[0], sha, path_parts[1:] if len(path_parts) > 1 else []))
    
    # 简化：创建一个简单的 tree
    tree_content = b""
    for mode, name, sha, _ in sorted(tree_entries):
        tree_content += f"{mode:06o} {name}\0".encode() + bytes.fromhex(sha)
    
    return create_git_object(tree_content, "tree")

def create_commit(tree_sha, parent=None, message="", author="Auto <auto@example.com>"):
    """创建 commit 对象"""
    timestamp = int(datetime.now().timestamp())
    tz_offset = "+0000"
    
    commit_lines = [
        f"tree {tree_sha}",
    ]
    if parent:
        commit_lines.append(f"parent {parent}")
    
    commit_lines.extend([
        f"author {author} {timestamp} {tz_offset}",
        f"committer {author} {timestamp} {tz_offset}",
        "",
        message
    ])
    
    commit_content = "\n".join(commit_lines).encode()
    return create_git_object(commit_content, "commit")

def setup_git_repo():
    """设置完整的 git 仓库"""
    repo_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(repo_dir)
    
    print("=" * 60)
    print("创建 Git 仓库结构")
    print("=" * 60)
    
    # 创建 .git 目录结构
    git_dir = ".git"
    os.makedirs(git_dir, exist_ok=True)
    os.makedirs(os.path.join(git_dir, "objects"), exist_ok=True)
    os.makedirs(os.path.join(git_dir, "refs", "heads"), exist_ok=True)
    os.makedirs(os.path.join(git_dir, "refs", "tags"), exist_ok=True)
    os.makedirs(os.path.join(git_dir, "hooks"), exist_ok=True)
    os.makedirs(os.path.join(git_dir, "info"), exist_ok=True)
    
    print("✅ Git 目录结构已创建")
    
    # 创建 HEAD 文件
    with open(os.path.join(git_dir, "HEAD"), "w") as f:
        f.write("ref: refs/heads/localAiModule\n")
    print("✅ HEAD 文件已创建")
    
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
    print("✅ Git 配置已创建")
    
    # 创建 description 文件
    with open(os.path.join(git_dir, "description"), "w") as f:
        f.write("Unnamed repository; edit this file 'description' to name the repository.\n")
    
    # 创建 info/exclude 文件
    with open(os.path.join(git_dir, "info", "exclude"), "w") as f:
        f.write("# git ls-files --others --exclude-from=.git/info/exclude\n")
    
    print("\n" + "=" * 60)
    print("Git 仓库结构创建完成！")
    print("=" * 60)
    print("\n下一步：")
    print("1. 修复 CommandLineTools: sudo xcode-select --reset")
    print("2. 然后执行: git add .")
    print("3. 然后执行: git commit -m 'Initial commit'")
    print("4. 然后执行: git push -u origin localAiModule")
    print("\n或者使用已提供的脚本尝试执行这些命令。")
    
    return True

if __name__ == "__main__":
    setup_git_repo()

