#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将 questions_auto_tag.json 扩展为多语言格式
使用AI翻译内容
"""

import json
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

INPUT_FILE = os.path.join(os.path.dirname(__file__), "../src/data/questions/zh/questions_auto_tag.json")

def translate_text(text, target_lang):
    """
    翻译文本
    这里需要实际的翻译逻辑，可以使用AI服务或翻译API
    """
    # TODO: 实现实际的翻译逻辑
    if target_lang == "en":
        return f"[EN] {text}"
    elif target_lang == "ja":
        return f"[JA] {text}"
    return text

def process_question(q):
    """处理单个问题，转换为多语言格式"""
    # 翻译 content
    content_en = translate_text(q["content"], "en")
    content_ja = translate_text(q["content"], "ja")
    
    # 翻译 explanation（如果存在）
    explanation = None
    if q.get("explanation"):
        explanation_en = translate_text(q["explanation"], "en")
        explanation_ja = translate_text(q["explanation"], "ja")
        explanation = {
            "zh": q["explanation"],
            "en": explanation_en,
            "ja": explanation_ja
        }
    
    # 构建多语言问题对象
    multilang_q = {
        **{k: v for k, v in q.items() if k not in ["content", "explanation"]},
        "content": {
            "zh": q["content"],
            "en": content_en,
            "ja": content_ja
        }
    }
    
    if explanation:
        multilang_q["explanation"] = explanation
    
    return multilang_q

def main():
    print("开始读取文件...")
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        questions = json.load(f)
    
    print(f"读取到 {len(questions)} 个问题")
    
    print("开始翻译...")
    multilang_questions = []
    
    for i, q in enumerate(questions):
        if (i + 1) % 50 == 0:
            print(f"处理进度: {i + 1}/{len(questions)}")
        
        multilang_q = process_question(q)
        multilang_questions.append(multilang_q)
    
    print("保存结果...")
    with open(INPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(multilang_questions, f, ensure_ascii=False, indent=2)
    
    print(f"完成！共处理 {len(multilang_questions)} 个问题")

if __name__ == "__main__":
    main()

