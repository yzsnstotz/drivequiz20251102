"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

type ErrorStatsResponse = {
  from: string;
  to: string;
  scene: string | null;
  byErrorCode: Array<{
    errorCode: string;
    count: number;
  }>;
  byTargetLanguage: Array<{
    targetLanguage: string;
    failedCount: number;
    totalCount: number;
  }>;
  byErrorStage: Array<{
    errorStage: string;
    count: number;
  }>;
  topQuestionIds: Array<{
    questionId: number;
    failedCount: number;
    lastErrorCode: string | null;
    lastErrorStage: string | null;
    lastErrorAt: string | null;
  }>;
};

export default function ErrorDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ErrorStatsResponse | null>(null);
  const [from, setFrom] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split("T")[0];
  });
  const [to, setTo] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [scene, setScene] = useState<string>("full_pipeline");

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<ErrorStatsResponse>(
        `/api/admin/question-processing/error-stats?from=${from}&to=${to}&scene=${scene}`
      );
      if (response.data) {
        setStats(response.data);
      } else {
        setError("Failed to load error stats");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load error stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [from, to, scene]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("zh-CN");
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">批量处理错误统计</h1>
        
        {/* 过滤条件 */}
        <div className="bg-white border rounded-lg p-4 mb-6">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">场景</label>
              <select
                value={scene}
                onChange={(e) => setScene(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="full_pipeline">full_pipeline</option>
                <option value="translate">translate</option>
                <option value="polish">polish</option>
                <option value="fill_missing">fill_missing</option>
                <option value="category_tags">category_tags</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={loadStats}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
              >
                刷新
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && stats && (
        <div className="space-y-6">
          {/* 1. 错误码分布 */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">错误码分布</h2>
            <div className="space-y-2">
              {stats.byErrorCode.length === 0 ? (
                <p className="text-gray-500 text-sm">暂无错误数据</p>
              ) : (
                stats.byErrorCode.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">{item.errorCode}</span>
                        <span className="text-sm text-gray-600">{item.count} 次</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-red-500 h-2 rounded-full"
                          style={{
                            width: `${(item.count / Math.max(...stats.byErrorCode.map((i) => i.count))) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. 按目标语言分布 */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">按目标语言分布</h2>
            <div className="grid grid-cols-3 gap-4">
              {stats.byTargetLanguage.length === 0 ? (
                <p className="text-gray-500 text-sm col-span-3">暂无数据</p>
              ) : (
                stats.byTargetLanguage.map((item, idx) => {
                  const failureRate = item.totalCount > 0 ? ((item.failedCount / item.totalCount) * 100).toFixed(1) : "0";
                  return (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        {item.targetLanguage === "unknown" ? "未知" : item.targetLanguage.toUpperCase()}
                      </div>
                      <div className="text-2xl font-bold text-red-600 mb-1">
                        {item.failedCount} / {item.totalCount}
                      </div>
                      <div className="text-xs text-gray-500">
                        失败率: {failureRate}%
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 3. 按错误阶段分布 */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">按错误阶段分布</h2>
            <div className="space-y-2">
              {stats.byErrorStage.length === 0 ? (
                <p className="text-gray-500 text-sm">暂无数据</p>
              ) : (
                stats.byErrorStage.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="text-sm font-medium text-gray-900">{item.errorStage}</span>
                    <span className="text-sm text-gray-600">{item.count} 次</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4. Top 问题题目列表 */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Top 问题题目列表</h2>
            {stats.topQuestionIds.length === 0 ? (
              <p className="text-gray-500 text-sm">暂无数据</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">题目ID</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">失败次数</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">最近错误码</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">最近错误阶段</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">最近错误时间</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {stats.topQuestionIds.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(String(item.questionId));
                              alert(`已复制题目ID: ${item.questionId}`);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-mono"
                            title="点击复制"
                          >
                            {item.questionId}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-red-600 font-medium">{item.failedCount}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-mono text-xs">
                          {item.lastErrorCode || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.lastErrorStage || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.lastErrorAt ? formatDate(item.lastErrorAt) : "-"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => {
                              window.open(`/admin/questions?search=${item.questionId}`, "_blank");
                            }}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            查看题目
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

