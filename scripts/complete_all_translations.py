#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
完成所有翻译的脚本
读取JSON文件，找出所有需要翻译的条目，然后完成翻译
"""

import json
import sys
import os

def translate_to_english(zh_text):
    """将中文翻译成英文 - 这里将由AI完成"""
    # 这个函数将在实际处理时由AI完成翻译
    return ""

def translate_to_japanese(zh_text):
    """将中文翻译成日文 - 这里将由AI完成"""
    # 这个函数将在实际处理时由AI完成翻译
    return ""

def main():
    # 读取文件
    file_path = os.path.join(os.path.dirname(__file__), '../src/data/questions/zh/questions_auto_tag.json')
    
    print('正在读取文件...')
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f'总共 {len(data)} 个问题')
    
    # 找出所有需要翻译的条目
    needs_translation = []
    
    for index, question in enumerate(data):
        needs = {
            'index': index,
            'id': question.get('id'),
            'contentZh': question.get('content', {}).get('zh', ''),
            'contentEn': not question.get('content', {}).get('en') or question.get('content', {}).get('en', '').strip() == '',
            'contentJa': not question.get('content', {}).get('ja') or question.get('content', {}).get('ja', '').strip() == '',
            'explanationZh': question.get('explanation', {}).get('zh', '') if question.get('explanation') else None,
            'explanationEn': question.get('explanation') and (not question.get('explanation', {}).get('en') or question.get('explanation', {}).get('en', '').strip() == ''),
            'explanationJa': question.get('explanation') and (not question.get('explanation', {}).get('ja') or question.get('explanation', {}).get('ja', '').strip() == ''),
        }
        
        if needs['contentEn'] or needs['contentJa'] or needs['explanationEn'] or needs['explanationJa']:
            needs_translation.append(needs)
    
    print(f'找到 {len(needs_translation)} 个需要翻译的条目')
    
    # 统计需要翻译的字段数
    total_fields = sum([
        (1 if n['contentEn'] else 0) +
        (1 if n['contentJa'] else 0) +
        (1 if n['explanationEn'] else 0) +
        (1 if n['explanationJa'] else 0)
        for n in needs_translation
    ])
    
    print(f'需要翻译 {total_fields} 个字段')
    
    # 导出需要翻译的数据
    output_path = os.path.join(os.path.dirname(__file__), 'needs-translation-final.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(needs_translation, f, ensure_ascii=False, indent=2)
    
    print(f'\n已导出翻译数据到: {output_path}')
    print('\n前10个需要翻译的条目:')
    for i, item in enumerate(needs_translation[:10]):
        print(f'\n{i+1}. ID: {item["id"]}')
        if item['contentEn']:
            print(f'   content.en: {item["contentZh"][:60]}...')
        if item['contentJa']:
            print(f'   content.ja: {item["contentZh"][:60]}...')
        if item['explanationEn']:
            print(f'   explanation.en: {item["explanationZh"][:60]}...')
        if item['explanationJa']:
            print(f'   explanation.ja: {item["explanationZh"][:60]}...')

if __name__ == '__main__':
    main()


