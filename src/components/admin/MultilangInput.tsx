"use client";

import React, { useState, useEffect } from "react";
import { useLanguage } from "@/lib/i18n";
import type { MultilangContent } from "@/types/multilang";

interface MultilangInputProps {
  value: MultilangContent | null | undefined;
  onChange: (value: { zh?: string; en?: string; ja?: string }) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  label?: string;
  multiline?: boolean;
}

/**
 * 多语言输入组件
 * 支持 zh, en, ja 三个语言的输入
 */
export default function MultilangInput({
  value,
  onChange,
  placeholder = "",
  rows = 3,
  required = false,
  label,
  multiline = false,
}: MultilangInputProps) {
  const { language } = useLanguage();
  const [currentLang, setCurrentLang] = useState<"zh" | "en" | "ja">("zh");
  const [values, setValues] = useState<{ zh: string; en: string; ja: string }>({
    zh: "",
    en: "",
    ja: "",
  });

  // 初始化值
  useEffect(() => {
    if (value) {
      if (typeof value === "string") {
        // 兼容旧数据：字符串格式，默认作为中文
        setValues({ zh: value, en: "", ja: "" });
      } else if (typeof value === "object") {
        setValues({
          zh: value.zh || "",
          en: value.en || "",
          ja: value.ja || "",
        });
      }
    } else {
      setValues({ zh: "", en: "", ja: "" });
    }
  }, [value]);

  // 根据当前语言设置初始标签页
  useEffect(() => {
    if (language === "zh") {
      setCurrentLang("zh");
    } else if (language === "en") {
      setCurrentLang("en");
    } else if (language === "ja") {
      setCurrentLang("ja");
    }
  }, [language]);

  const handleChange = (lang: "zh" | "en" | "ja", newValue: string) => {
    const newValues = { ...values, [lang]: newValue };
    setValues(newValues);
    
    // 过滤空值，只传递有内容的语言
    // 注意：只移除首尾空格，保留中间空格（英语必须要有空格）
    // trim() 只会移除首尾空格，不会移除中间空格，所以可以安全使用
    const filtered: { zh?: string; en?: string; ja?: string } = {};
    // 只 trim 用于检查是否为空，保存时保留原始值（包括中间空格）
    // trim() 不会移除中间空格，所以 "Hello World" 仍然是 "Hello World"
    if (newValues.zh.trim()) filtered.zh = newValues.zh.trim();
    if (newValues.en.trim()) filtered.en = newValues.en.trim();
    if (newValues.ja.trim()) filtered.ja = newValues.ja.trim();
    
    onChange(filtered);
  };

  const languages: Array<{ code: "zh" | "en" | "ja"; label: string }> = [
    { code: "zh", label: "中文" },
    { code: "en", label: "English" },
    { code: "ja", label: "日本語" },
  ];

  const InputComponent = multiline ? "textarea" : "input";

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      {/* 语言标签页 */}
      <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700">
        {languages.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => setCurrentLang(lang.code)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              currentLang === lang.code
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>

      {/* 当前语言的输入框 */}
      <div className="relative">
        {multiline ? (
          <textarea
            value={values[currentLang]}
            onChange={(e) => handleChange(currentLang, e.target.value)}
            placeholder={placeholder || `请输入${languages.find((l) => l.code === currentLang)?.label}内容`}
            rows={rows}
            required={required && currentLang === "zh"} // 只有中文是必填时，才标记为 required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        ) : (
          <input
            type="text"
            value={values[currentLang]}
            onChange={(e) => handleChange(currentLang, e.target.value)}
            placeholder={placeholder || `请输入${languages.find((l) => l.code === currentLang)?.label}内容`}
            required={required && currentLang === "zh"} // 只有中文是必填时，才标记为 required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        )}
      </div>

      {/* 提示：可以切换语言标签页输入其他语言 */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        提示：可以切换上方语言标签页输入其他语言内容
      </p>
    </div>
  );
}

