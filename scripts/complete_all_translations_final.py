#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

file_path = os.path.join(os.path.dirname(__file__), '../src/data/questions/zh/questions_auto_tag.json')

print('读取文件...')
with open(file_path, 'r', encoding='utf-8') as f:
    questions = json.load(f)

print(f'总共 {len(questions)} 个题目')

def generate_explanation(content, correct_answer, question_type):
    """生成explanation内容"""
    zh_content = content.replace(re.match(r'^\d+[\.、]\s*', content).group() if re.match(r'^\d+[\.、]\s*', content) else '', '').strip()
    
    if question_type == 'truefalse':
        if correct_answer == 'true':
            return f'根据题目描述，该说法是正确的。{content}'
        else:
            return f'根据题目描述，该说法是错误的。{content}'
    elif question_type == 'multiplechoice':
        return f'正确答案是{correct_answer}。{content}'
    return f'根据题目内容：{content}'

import re

stats = {
    'content_en': 0,
    'content_ja': 0,
    'explanation_added': 0,
    'explanation_en': 0,
    'explanation_ja': 0
}

# 处理所有题目
for i, q in enumerate(questions):
    # 处理content字段
    if q.get('content') and q['content'].get('zh'):
        zh = q['content']['zh']
        
        if not q['content'].get('en') or q['content']['en'].strip() == '':
            stats['content_en'] += 1
        
        if not q['content'].get('ja') or q['content']['ja'].strip() == '':
            stats['content_ja'] += 1
    
    # 处理explanation字段
    if not q.get('explanation'):
        zh_content = q.get('content', {}).get('zh', '')
        generated_zh = generate_explanation(zh_content, q.get('correctAnswer', ''), q.get('type', ''))
        
        q['explanation'] = {
            'zh': generated_zh,
            'en': '',  # 需要翻译
            'ja': ''   # 需要翻译
        }
        stats['explanation_added'] += 1
        stats['explanation_en'] += 1
        stats['explanation_ja'] += 1
    elif q.get('explanation', {}).get('zh'):
        zh_exp = q['explanation']['zh']
        
        if not q['explanation'].get('en') or q['explanation']['en'].strip() == '':
            stats['explanation_en'] += 1
        
        if not q['explanation'].get('ja') or q['explanation']['ja'].strip() == '':
            stats['explanation_ja'] += 1
    
    if (i + 1) % 100 == 0:
        print(f'已检查 {i + 1}/{len(questions)} 个题目...')

print('\n统计:')
print(f'- Content EN需要翻译: {stats["content_en"]}')
print(f'- Content JA需要翻译: {stats["content_ja"]}')
print(f'- Explanation新增: {stats["explanation_added"]}')
print(f'- Explanation EN需要翻译: {stats["explanation_en"]}')
print(f'- Explanation JA需要翻译: {stats["explanation_ja"]}')

print('\n由于翻译需要AI完成，现在需要通过编辑文件来完成所有翻译...')
