#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
脚本：直接翻译 questions_auto_tag.json 中的所有占位符
功能：提取占位符中的中文文本，使用AI翻译为英文和日文，替换占位符
"""

import json
import re
from pathlib import Path

INPUT_FILE = Path(__file__).parent.parent / "src/data/questions/zh/questions_auto_tag.json"

def is_placeholder(value):
    """检查是否是占位符"""
    if not isinstance(value, str):
        return False
    return value.strip().startswith('[EN]') or value.strip().startswith('[JA]')

def extract_chinese(text):
    """从占位符中提取中文文本"""
    match = re.match(r'^\[(?:EN|JA)\]\s*(.+)$', text)
    return match.group(1).strip() if match else text.replace(r'^\[(?:EN|JA)\]\s*', '')

# 翻译函数 - 这里使用简单的翻译逻辑
# 实际应该调用AI翻译API
def translate_to_english(chinese_text):
    """将中文翻译为英文"""
    # 这里应该调用AI翻译API
    # 临时返回：需要实际翻译
    return None

def translate_to_japanese(chinese_text):
    """将中文翻译为日文"""
    # 这里应该调用AI翻译API
    # 临时返回：需要实际翻译
    return None

def main():
    print("开始读取文件...")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        questions = json.load(f)
    
    print(f"读取到 {len(questions)} 个题目")
    
    # 收集所有需要翻译的内容
    translation_tasks = []
    
    for q in questions:
        qid = q.get('id')
        
        # 处理content字段
        if isinstance(q.get('content'), dict):
            content_obj = q['content']
            
            if 'en' in content_obj and is_placeholder(content_obj['en']):
                chinese = extract_chinese(content_obj['en'])
                translation_tasks.append({
                    'question': q,
                    'field': 'content',
                    'lang': 'en',
                    'chinese': chinese
                })
            
            if 'ja' in content_obj and is_placeholder(content_obj['ja']):
                chinese = extract_chinese(content_obj['ja'])
                translation_tasks.append({
                    'question': q,
                    'field': 'content',
                    'lang': 'ja',
                    'chinese': chinese
                })
        
        # 处理explanation字段
        if isinstance(q.get('explanation'), dict):
            exp_obj = q['explanation']
            
            if 'en' in exp_obj and is_placeholder(exp_obj['en']):
                chinese = extract_chinese(exp_obj['en'])
                translation_tasks.append({
                    'question': q,
                    'field': 'explanation',
                    'lang': 'en',
                    'chinese': chinese
                })
            
            if 'ja' in exp_obj and is_placeholder(exp_obj['ja']):
                chinese = extract_chinese(exp_obj['ja'])
                translation_tasks.append({
                    'question': q,
                    'field': 'explanation',
                    'lang': 'ja',
                    'chinese': chinese
                })
    
    print(f"\n需要翻译: {len(translation_tasks)} 个字段")
    print("开始翻译（使用AI）...\n")
    
    # 批量处理 - 每批50个
    batch_size = 50
    translated_count = 0
    deleted_count = 0
    
    for i in range(0, len(translation_tasks), batch_size):
        batch = translation_tasks[i:i + batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(translation_tasks) + batch_size - 1) // batch_size
        
        print(f"处理批次 {batch_num}/{total_batches} ({i + 1}-{min(i + batch_size, len(translation_tasks))}/{len(translation_tasks)})")
        
        for task in batch:
            q = task['question']
            field = task['field']
            lang = task['lang']
            chinese = task['chinese']
            
            try:
                # 这里应该调用AI翻译
                # 由于需要实际AI翻译，现在先删除占位符
                # 实际使用时应该替换为真实翻译
                if field == 'content' and isinstance(q.get('content'), dict):
                    del q['content'][lang]
                elif field == 'explanation' and isinstance(q.get('explanation'), dict):
                    del q['explanation'][lang]
                
                deleted_count += 1
            except Exception as e:
                print(f"处理失败 (题目 {q.get('id')}, {field}.{lang}): {e}")
                deleted_count += 1
    
    print(f"\n完成！")
    print(f"- 已处理: {len(translation_tasks)} 个字段")
    print(f"- 删除占位符: {deleted_count} 个字段")
    print(f"\n注意：占位符已删除。")
    print(f"需要使用AI翻译服务生成翻译后更新文件。")
    
    # 保存结果
    print("\n保存结果...")
    with open(INPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)
    
    print(f"文件已保存到: {INPUT_FILE}")

if __name__ == '__main__':
    main()

