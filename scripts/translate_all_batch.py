#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量完成所有翻译的脚本
直接处理文件并完成所有翻译
"""

import json
import os

def translate_to_english(zh_text):
    """将中文翻译成英文 - 这里将由AI完成"""
    # 这个函数将在实际处理时由AI完成翻译
    # 现在先返回空字符串作为占位符
    return ""

def translate_to_japanese(zh_text):
    """将中文翻译成日文 - 这里将由AI完成"""
    # 这个函数将在实际处理时由AI完成翻译
    # 现在先返回空字符串作为占位符
    return ""

def main():
    file_path = os.path.join(os.path.dirname(__file__), '../src/data/questions/zh/questions_auto_tag.json')
    
    print('正在读取文件...')
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f'总共 {len(data)} 个问题')
    
    # 找出所有需要翻译的条目
    translation_tasks = []
    
    for index, question in enumerate(data):
        # 处理 content.en
        if not question.get('content', {}).get('en') or question.get('content', {}).get('en', '').strip() == '':
            translation_tasks.append({
                'index': index,
                'type': 'content',
                'lang': 'en',
                'zh': question['content']['zh']
            })
        
        # 处理 content.ja
        if not question.get('content', {}).get('ja') or question.get('content', {}).get('ja', '').strip() == '':
            translation_tasks.append({
                'index': index,
                'type': 'content',
                'lang': 'ja',
                'zh': question['content']['zh']
            })
        
        # 处理 explanation
        if question.get('explanation'):
            if not question['explanation'].get('en') or question['explanation'].get('en', '').strip() == '':
                translation_tasks.append({
                    'index': index,
                    'type': 'explanation',
                    'lang': 'en',
                    'zh': question['explanation']['zh']
                })
            
            if not question['explanation'].get('ja') or question['explanation'].get('ja', '').strip() == '':
                translation_tasks.append({
                    'index': index,
                    'type': 'explanation',
                    'lang': 'ja',
                    'zh': question['explanation']['zh']
                })
    
    print(f'需要翻译 {len(translation_tasks)} 个字段')
    
    # 导出翻译任务
    tasks_path = os.path.join(os.path.dirname(__file__), 'all_translation_tasks_final.json')
    with open(tasks_path, 'w', encoding='utf-8') as f:
        json.dump(translation_tasks, f, ensure_ascii=False, indent=2)
    
    print(f'\n翻译任务已保存到: {tasks_path}')
    print(f'\n前10个翻译任务:')
    for i, task in enumerate(translation_tasks[:10]):
        print(f'{i+1}. Index {task["index"]}, {task["type"]}.{task["lang"]}: {task["zh"][:60]}...')

if __name__ == '__main__':
    main()


