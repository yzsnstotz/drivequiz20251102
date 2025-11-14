#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量完成所有翻译任务
读取 questions_auto_tag.json，找出所有需要翻译的内容，逐个翻译并更新
"""

import json
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

INPUT_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src/data/questions/zh/questions_auto_tag.json")
BATCH_SIZE = 50  # 每批处理50个翻译任务
SAVE_INTERVAL = 50  # 每处理50个任务保存一次

def needs_translation(field):
    """检查字段是否需要翻译"""
    if not field:
        return False
    
    has_zh = field.get("zh") and field["zh"].strip() != ""
    has_en = field.get("en") and field["en"].strip() != ""
    has_ja = field.get("ja") and field["ja"].strip() != ""
    
    # 如果只有 zh，缺少 en 或 ja，则需要翻译
    return has_zh and (not has_en or not has_ja)

def collect_translation_tasks(questions):
    """收集所有需要翻译的任务"""
    tasks = []
    
    for i, q in enumerate(questions):
        # 处理 content
        if isinstance(q.get("content"), str):
            content = {"zh": q["content"]}
        else:
            content = q.get("content") or {}
        
        if needs_translation(content):
            zh_text = content.get("zh", "").strip()
            if zh_text:
                if not content.get("en") or content["en"].strip() == "":
                    tasks.append({
                        "question_index": i,
                        "question_id": q.get("id", str(i)),
                        "field_type": "content",
                        "target_lang": "en",
                        "zh_text": zh_text
                    })
                if not content.get("ja") or content["ja"].strip() == "":
                    tasks.append({
                        "question_index": i,
                        "question_id": q.get("id", str(i)),
                        "field_type": "content",
                        "target_lang": "ja",
                        "zh_text": zh_text
                    })
        
        # 处理 explanation
        explanation = q.get("explanation")
        if explanation:
            if isinstance(explanation, str):
                expl_content = {"zh": explanation}
            else:
                expl_content = explanation or {}
            
            if needs_translation(expl_content):
                zh_text = expl_content.get("zh", "").strip()
                if zh_text:
                    if not expl_content.get("en") or expl_content["en"].strip() == "":
                        tasks.append({
                            "question_index": i,
                            "question_id": q.get("id", str(i)),
                            "field_type": "explanation",
                            "target_lang": "en",
                            "zh_text": zh_text
                        })
                    if not expl_content.get("ja") or expl_content["ja"].strip() == "":
                        tasks.append({
                            "question_index": i,
                            "question_id": q.get("id", str(i)),
                            "field_type": "explanation",
                            "target_lang": "ja",
                            "zh_text": zh_text
                        })
    
    return tasks

def main():
    print("开始读取文件...")
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        questions = json.load(f)
    print(f"读取到 {len(questions)} 个问题\n")
    
    # 收集所有翻译任务
    print("收集翻译任务...")
    tasks = collect_translation_tasks(questions)
    print(f"找到 {len(tasks)} 个翻译任务\n")
    
    if len(tasks) == 0:
        print("所有翻译已完成！")
        return
    
    print("开始翻译...\n")
    print(f"注意：此脚本需要实际的翻译实现。")
    print(f"由于需要通过AI完成翻译，建议使用其他方法完成翻译。")
    print(f"\n翻译任务列表已准备好，共 {len(tasks)} 个任务。")
    print(f"前5个任务示例：")
    for i, task in enumerate(tasks[:5]):
        print(f"  {i+1}. 问题 {task['question_id']} - {task['field_type']} - {task['target_lang']}")
        print(f"     原文: {task['zh_text'][:50]}...")

if __name__ == "__main__":
    main()

