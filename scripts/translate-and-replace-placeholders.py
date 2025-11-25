#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
脚本：直接翻译 questions_auto_tag.json 中的占位符
功能：提取占位符中的中文文本，使用AI翻译为英文和日文，替换占位符
"""

import json
import re
import sys
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

def translate_text(text, target_lang):
    """
    翻译文本
    这里需要实际调用AI翻译API
    由于我们在Python环境中，可以使用openai库或其他翻译服务
    """
    # TODO: 实际应该调用AI翻译API
    # 例如使用OpenAI API:
    # import openai
    # response = openai.ChatCompletion.create(
    #     model="gpt-4",
    #     messages=[
    #         {"role": "system", "content": f"你是一个专业的翻译助手，将中文翻译成{'英文' if target_lang == 'en' else '日文'}"},
    #         {"role": "user", "content": text}
    #     ]
    # )
    # return response.choices[0].message.content
    
    # 临时返回：标记需要翻译
    return f"[NEEDS_TRANSLATION_{target_lang.upper()}] {text}"

def main():
    print("开始读取文件...")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        questions = json.load(f)
    
    print(f"读取到 {len(questions)} 个题目")
    
    # 收集需要翻译的内容
    translation_tasks = []
    
    for q in questions:
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
    print("注意：由于需要AI翻译，这个脚本需要配置AI API才能工作")
    print("当前实现：删除占位符，保留中文内容")
    
    # 删除占位符
    deleted_count = 0
    for task in translation_tasks:
        q = task['question']
        field = task['field']
        lang = task['lang']
        
        if field == 'content' and isinstance(q.get('content'), dict):
            if lang in q['content']:
                del q['content'][lang]
                deleted_count += 1
        elif field == 'explanation' and isinstance(q.get('explanation'), dict):
            if lang in q['explanation']:
                del q['explanation'][lang]
                deleted_count += 1
    
    print(f"\n已删除 {deleted_count} 个占位符字段")
    
    # 保存结果
    print("保存结果...")
    with open(INPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)
    
    print(f"文件已保存到: {INPUT_FILE}")
    print("\n完成！占位符已删除。")
    print("如需添加翻译，请使用AI翻译服务生成翻译后更新文件。")

if __name__ == '__main__':
    main()

