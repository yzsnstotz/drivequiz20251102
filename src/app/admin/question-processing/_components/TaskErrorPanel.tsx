"use client";

import React, { useState } from "react";

type ErrorItem = {
  questionId: number;
  error: string;
};

type TaskErrorPanelProps = {
  errors: Array<ErrorItem> | null;
};

export function TaskErrorPanel({ errors }: TaskErrorPanelProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // 如果没有错误，不显示面板
  if (!errors || errors.length === 0) {
    return null;
  }

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("复制失败:", err);
      alert("复制失败，请手动复制");
    }
  };

  return (
    <div className="bg-white border border-red-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-red-700">
          错误信息 ({errors.length} 条)
        </h3>
        {errors.length > 1 && (
          <button
            onClick={() => {
              const allErrors = errors
                .map((e) => `题目 ${e.questionId}: ${e.error}`)
                .join("\n");
              handleCopy(allErrors, -1);
            }}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {copiedIndex === -1 ? "已复制" : "复制全部"}
          </button>
        )}
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {errors.map((item, index) => (
          <div
            key={index}
            className="p-3 bg-red-50 border border-red-100 rounded text-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-medium text-red-800">
                    题目 ID: {item.questionId}
                  </span>
                  <button
                    onClick={() => {
                      window.open(
                        `/admin/questions?search=${item.questionId}`,
                        "_blank"
                      );
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800"
                    title="查看题目"
                  >
                    查看
                  </button>
                </div>
                <p className="text-red-700 whitespace-pre-wrap break-words">
                  {item.error}
                </p>
              </div>
              <button
                onClick={() => handleCopy(item.error, index)}
                className="ml-2 text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                title="复制错误信息"
              >
                {copiedIndex === index ? "已复制" : "复制"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
