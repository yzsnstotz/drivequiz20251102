"use client";

import React, { useEffect, useState, useRef } from "react";
import { apiFetch, apiPost, apiDelete, ApiError } from "@/lib/apiClient";

type TaskStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

type BatchProcessTask = {
  id: number;
  task_id: string;
  status: TaskStatus;
  operations: string[];
  question_ids: number[] | null;
  total_questions: number;
  processed_count: number;
  succeeded_count: number;
  failed_count: number;
  current_batch: number;
  errors: Array<{ questionId: number; error: string }> | null;
  details: Array<{ questionId: number; operations: string[]; status: string }> | null;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type TasksResponse = {
  tasks: BatchProcessTask[];
  total: number;
  limit: number;
  offset: number;
};

export default function QuestionProcessingPage() {
  const [tasks, setTasks] = useState<BatchProcessTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedTask, setSelectedTask] = useState<BatchProcessTask | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const detailRefreshRef = useRef<NodeJS.Timeout | null>(null);
  const [currentAiLogs, setCurrentAiLogs] = useState<Array<{ question: string; answer: string; model: string; created_at: string }>>([]);
  const errorCountRef = useRef<number>(0); // 错误计数
  const MAX_ERROR_COUNT = 3; // 连续失败 3 次后停止刷新

  // 创建任务表单状态
  const [formData, setFormData] = useState<{
    questionIds: string;
    operations: string[];
    translateOptions: { from: string; to: string | string[] };
    polishOptions: { locale: string };
    batchSize: number;
    continueOnError: boolean;
  }>({
    questionIds: "",
    operations: [],
    translateOptions: { from: "zh", to: ["ja"] }, // 改为数组，支持多选
    polishOptions: { locale: "zh-CN" },
    batchSize: 10,
    continueOnError: true,
  });

  const loadTasks = async (): Promise<BatchProcessTask[]> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "50");
      params.set("offset", "0");

      const response = await apiFetch<TasksResponse>(
        `/api/admin/question-processing/batch-process?${params.toString()}`
      );

      if (response.data) {
        const loadedTasks = response.data.tasks || [];
        setTasks(loadedTasks);
        return loadedTasks;
      } else {
        setError("加载任务列表失败");
        return [];
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "加载任务列表失败");
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [statusFilter]);

  // 加载当前任务的 AI 日志
  const loadCurrentAiLogs = async (taskId: string) => {
    try {
      // 获取任务详情，找到当前正在处理的题目
      const task = tasks.find(t => t.task_id === taskId);
      if (!task || (task.status !== "processing" && task.status !== "pending")) {
        setCurrentAiLogs([]);
        return;
      }

      // 通过 API 获取最近的相关 AI 日志
      const token = typeof window !== "undefined" ? window.localStorage.getItem("ADMIN_TOKEN") : null;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 秒超时
      
      try {
        const res = await fetch(`/api/admin/question-processing/task-ai-logs?taskId=${encodeURIComponent(taskId)}&limit=5`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const json = await res.json();
          if (json.ok && json.data?.logs) {
            setCurrentAiLogs(json.data.logs);
          }
        } else {
          // 如果返回错误，不更新日志，但也不抛出错误（避免影响主流程）
          console.warn(`[loadCurrentAiLogs] API returned ${res.status}`);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.warn("[loadCurrentAiLogs] Request timeout");
        } else {
          throw fetchError;
        }
      }
    } catch (e) {
      // 静默处理错误，不抛出（避免影响主流程）
      console.error("Failed to load AI logs:", e);
    }
  };

  // 自动刷新正在处理的任务
  useEffect(() => {
    // 清理之前的 interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!autoRefresh) return;

    const checkAndRefresh = async () => {
      try {
        // 先加载最新任务列表
        const latestTasks = await loadTasks();
        
        // 重置错误计数（成功加载）
        errorCountRef.current = 0;
        
        // 如果任务详情窗口打开，更新选中的任务
        if (selectedTask) {
          const updatedTask = latestTasks.find(t => t.task_id === selectedTask.task_id);
          if (updatedTask) {
            setSelectedTask(updatedTask);
            // 如果任务已完成、失败或取消，停止刷新
            if (updatedTask.status === "completed" || updatedTask.status === "failed" || updatedTask.status === "cancelled") {
              if (detailRefreshRef.current) {
                clearInterval(detailRefreshRef.current);
                detailRefreshRef.current = null;
              }
              return;
            }
            // 如果任务正在处理，加载 AI 日志
            if (updatedTask.status === "processing") {
              loadCurrentAiLogs(updatedTask.task_id).catch((e) => {
                console.error("Failed to load AI logs:", e);
              });
            }
          }
        }
        
        // 检查是否有正在处理的任务
        const processingTasks = latestTasks.filter(
          (t) => t.status === "pending" || t.status === "processing"
        );

        if (processingTasks.length === 0) {
          // 没有正在处理的任务，停止自动刷新
          setAutoRefresh(false);
          return;
        }

        // 检查是否有任务长时间没有更新（超过 5 分钟）
        const now = Date.now();
        const STUCK_TIMEOUT = 5 * 60 * 1000; // 5 分钟
        
        const hasStuckTasks = processingTasks.some((task) => {
          const taskUpdatedAt = task.updated_at ? new Date(task.updated_at).getTime() : now;
          const timeSinceTaskUpdate = now - taskUpdatedAt;
          
          // 如果任务更新时间超过 5 分钟，认为任务卡住了
          if (timeSinceTaskUpdate > STUCK_TIMEOUT) {
            return true;
          }
          
          return false;
        });

        if (hasStuckTasks) {
          console.warn("[BatchProcess] 检测到任务可能卡住（超过 5 分钟未更新），停止自动刷新");
          setAutoRefresh(false);
          return;
        }
      } catch (e) {
        // 错误处理：增加错误计数
        errorCountRef.current += 1;
        console.error("[BatchProcess] 刷新任务列表失败:", e);
        
        // 如果连续失败超过最大次数，停止自动刷新
        if (errorCountRef.current >= MAX_ERROR_COUNT) {
          console.error(`[BatchProcess] 连续失败 ${MAX_ERROR_COUNT} 次，停止自动刷新`);
          setAutoRefresh(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return;
        }
      }
    };

    // 立即执行一次检查
    checkAndRefresh();

    // 设置定时器，每 5 秒刷新一次（减少频率）
    intervalRef.current = setInterval(() => {
      checkAndRefresh();
    }, 5000); // 改为 5 秒刷新一次

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, selectedTask, tasks]);

  // 当任务详情窗口打开时，自动刷新该任务
  useEffect(() => {
    // 使用 ref 来跟踪是否应该继续刷新
    let shouldRefresh = true;
    
    if (!selectedTask) {
      if (detailRefreshRef.current) {
        clearInterval(detailRefreshRef.current);
        detailRefreshRef.current = null;
      }
      setCurrentAiLogs([]);
      shouldRefresh = false;
      return;
    }

    const taskId = selectedTask.task_id; // 保存 taskId 到局部变量

    // 如果任务正在处理，设置定时刷新
    if (selectedTask.status === "processing" || selectedTask.status === "pending") {
      let detailErrorCount = 0; // 任务详情刷新的错误计数
      
      const refreshDetail = async () => {
        // 检查是否应该继续刷新（防止在组件卸载或任务关闭后继续刷新）
        if (!shouldRefresh) {
          if (detailRefreshRef.current) {
            clearInterval(detailRefreshRef.current);
            detailRefreshRef.current = null;
          }
          return;
        }

        try {
          const latestTasks = await loadTasks();
          const updatedTask = latestTasks.find(t => t.task_id === taskId);
          
          if (updatedTask) {
            // 重置错误计数（成功加载）
            detailErrorCount = 0;
            
            // 如果任务已完成、失败或取消，停止刷新
            if (updatedTask.status === "completed" || updatedTask.status === "failed" || updatedTask.status === "cancelled") {
              shouldRefresh = false;
              if (detailRefreshRef.current) {
                clearInterval(detailRefreshRef.current);
                detailRefreshRef.current = null;
              }
              setCurrentAiLogs([]);
              return;
            }
            
            // 只有在任务详情窗口仍然打开时才更新
            setSelectedTask((current) => {
              if (current && current.task_id === taskId) {
                return updatedTask;
              }
              return current;
            });
            
            // 加载 AI 日志（不阻塞，失败也不影响主流程）
            loadCurrentAiLogs(taskId).catch((e) => {
              console.error("Failed to load AI logs:", e);
            });
          } else {
            // 任务不存在，停止刷新
            shouldRefresh = false;
            if (detailRefreshRef.current) {
              clearInterval(detailRefreshRef.current);
              detailRefreshRef.current = null;
            }
          }
        } catch (e) {
          // 错误处理：增加错误计数
          detailErrorCount += 1;
          console.error("Failed to refresh task detail:", e);
          
          // 如果连续失败超过最大次数，停止刷新
          if (detailErrorCount >= MAX_ERROR_COUNT) {
            console.error(`[TaskDetail] 连续失败 ${MAX_ERROR_COUNT} 次，停止刷新任务详情`);
            shouldRefresh = false;
            if (detailRefreshRef.current) {
              clearInterval(detailRefreshRef.current);
              detailRefreshRef.current = null;
            }
            return;
          }
        }
      };

      // 立即刷新一次
      refreshDetail();

      // 每 3 秒刷新一次任务详情（增加间隔，减少请求频率）
      detailRefreshRef.current = setInterval(refreshDetail, 5000); // 改为 5 秒
    } else {
      if (detailRefreshRef.current) {
        clearInterval(detailRefreshRef.current);
        detailRefreshRef.current = null;
      }
      setCurrentAiLogs([]);
      shouldRefresh = false;
    }

    return () => {
      shouldRefresh = false;
      if (detailRefreshRef.current) {
        clearInterval(detailRefreshRef.current);
        detailRefreshRef.current = null;
      }
    };
  }, [selectedTask?.task_id, selectedTask?.status]); // 只依赖 task_id 和 status，避免频繁重建

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const payload: any = {
        operations: formData.operations,
        batchSize: formData.batchSize,
        continueOnError: formData.continueOnError,
      };

      // 处理题目ID
      if (formData.questionIds) {
        const ids = formData.questionIds
          .split(",")
          .map((id) => parseInt(id.trim()))
          .filter((id) => !isNaN(id));
        if (ids.length > 0) {
          payload.questionIds = ids;
        }
      }

      // 添加操作选项
      if (formData.operations.includes("translate")) {
        payload.translateOptions = formData.translateOptions;
      }
      if (formData.operations.includes("polish")) {
        payload.polishOptions = formData.polishOptions;
      }

      const response = await apiPost<{ task_id: string }>(
        "/api/admin/question-processing/batch-process",
        payload
      );

      // apiPost 成功时返回 ApiSuccess，失败时抛出 ApiError
      setShowCreateForm(false);
      setFormData({
        questionIds: "",
        operations: [],
        translateOptions: { from: "zh", to: ["ja"] },
        polishOptions: { locale: "zh-CN" },
        batchSize: 10,
        continueOnError: true,
      });
      await loadTasks();
      setAutoRefresh(true);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "创建任务失败");
    } finally {
      setCreating(false);
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: TaskStatus) => {
    switch (status) {
      case "pending":
        return "等待中";
      case "processing":
        return "处理中";
      case "completed":
        return "已完成";
      case "failed":
        return "失败";
      case "cancelled":
        return "已取消";
      default:
        return status;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("zh-CN");
  };

  const getProgress = (task: BatchProcessTask) => {
    if (task.total_questions === 0) return 0;
    return Math.round((task.processed_count / task.total_questions) * 100);
  };

  const handleCancelTask = async (taskId: string) => {
    if (!confirm("确定要取消这个任务吗？")) {
      return;
    }

    setCancellingTaskId(taskId);
    setError(null);

    try {
      await apiDelete<{ taskId: string; status: string; message: string }>(
        `/api/admin/question-processing/batch-process?taskId=${taskId}&action=cancel`
      );
      await loadTasks();
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "取消任务失败");
    } finally {
      setCancellingTaskId(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("确定要删除这个任务吗？删除后无法恢复。")) {
      return;
    }

    setDeletingTaskId(taskId);
    setError(null);

    try {
      await apiDelete<{ taskId: string; status: string; message: string }>(
        `/api/admin/question-processing/batch-process?taskId=${taskId}&action=delete`
      );
      await loadTasks();
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "删除任务失败");
    } finally {
      setDeletingTaskId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">批量题目处理</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              autoRefresh
                ? "bg-green-500 text-white hover:bg-green-600"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {autoRefresh ? "🔄 自动刷新中" : "⏸️ 暂停刷新"}
          </button>
          <button
            onClick={loadTasks}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "加载中..." : "刷新"}
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 rounded-lg bg-purple-500 text-white text-sm font-medium hover:bg-purple-600"
          >
            + 创建任务
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* 创建任务表单 */}
      {showCreateForm && (
        <div className="border rounded-lg p-6 bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-4">创建批量处理任务</h2>
          <form onSubmit={handleCreateTask} className="space-y-4">
            {/* 操作类型 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                操作类型 <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {[
                  { value: "polish", label: "润色" },
                  { value: "fill_missing", label: "填漏" },
                  { value: "category_tags", label: "分类标签" },
                  { value: "translate", label: "翻译" }, // 翻译放到最后
                ].map((op) => (
                  <label key={op.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.operations.includes(op.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            operations: [...formData.operations, op.value],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            operations: formData.operations.filter(
                              (o) => o !== op.value
                            ),
                          });
                        }
                      }}
                      className="rounded"
                    />
                    <span>{op.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 题目ID（可选） */}
            <div>
              <label className="block text-sm font-medium mb-2">
                题目ID（可选，留空则处理全部题目）
              </label>
              <input
                type="text"
                value={formData.questionIds}
                onChange={(e) =>
                  setFormData({ ...formData, questionIds: e.target.value })
                }
                placeholder="例如: 1,2,3,4,5 或留空处理全部"
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                多个ID用逗号分隔，留空则处理数据库中的所有题目
              </p>
            </div>

            {/* 翻译选项 - 放在最后 */}
            {formData.operations.includes("translate") && (
              <div className="border-l-4 border-blue-500 pl-4 space-y-3 mt-4">
                <h3 className="font-medium text-blue-700">翻译选项（最后执行）</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">源语言</label>
                    <select
                      value={formData.translateOptions.from}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          translateOptions: {
                            ...formData.translateOptions,
                            from: e.target.value,
                          },
                        })
                      }
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="zh">中文 (zh)</option>
                      <option value="ja">日文 (ja)</option>
                      <option value="en">英文 (en)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      目标语言 <span className="text-blue-600 font-semibold">(可多选)</span>
                    </label>
                    <div className="space-y-2 border-2 border-blue-300 rounded-lg px-3 py-3 min-h-[120px] max-h-[180px] overflow-y-auto bg-blue-50">
                      {[
                        { value: "zh", label: "中文 (zh)" },
                        { value: "ja", label: "日文 (ja)" },
                        { value: "en", label: "英文 (en)" },
                      ].map((lang) => {
                        const toArray = Array.isArray(formData.translateOptions.to)
                          ? formData.translateOptions.to
                          : [formData.translateOptions.to];
                        const isChecked = toArray.includes(lang.value);
                        return (
                          <label key={lang.value} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-blue-100 rounded">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const currentTo = Array.isArray(formData.translateOptions.to)
                                  ? formData.translateOptions.to
                                  : [formData.translateOptions.to];
                                let newTo: string[];
                                if (e.target.checked) {
                                  // 添加语言
                                  newTo = [...currentTo, lang.value];
                                } else {
                                  // 移除语言，但至少保留一个
                                  newTo = currentTo.filter((l) => l !== lang.value);
                                  if (newTo.length === 0) {
                                    // 如果全部取消，至少保留一个
                                    newTo = [lang.value];
                                  }
                                }
                                setFormData({
                                  ...formData,
                                  translateOptions: {
                                    ...formData.translateOptions,
                                    to: newTo,
                                  },
                                });
                              }}
                              className="rounded w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm font-medium">{lang.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-blue-600 font-medium mt-2">
                      ✓ 已选择: {Array.isArray(formData.translateOptions.to) 
                        ? formData.translateOptions.to.join(", ")
                        : formData.translateOptions.to}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 润色选项 */}
            {formData.operations.includes("polish") && (
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-medium mb-2">润色选项</h3>
                <div>
                  <label className="block text-sm font-medium mb-1">语言</label>
                  <select
                    value={formData.polishOptions.locale}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        polishOptions: {
                          ...formData.polishOptions,
                          locale: e.target.value,
                        },
                      })
                    }
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="zh-CN">中文 (zh-CN)</option>
                    <option value="ja-JP">日文 (ja-JP)</option>
                    <option value="en-US">英文 (en-US)</option>
                  </select>
                </div>
              </div>
            )}

            {/* 批量大小 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                每批处理数量
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.batchSize}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    batchSize: parseInt(e.target.value) || 10,
                  })
                }
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                每批处理的题目数量，建议 10-20
              </p>
            </div>

            {/* 错误处理 */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.continueOnError}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      continueOnError: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                <span className="text-sm">遇到错误时继续处理</span>
              </label>
            </div>

            {/* 按钮 */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={creating || formData.operations.length === 0}
                className="px-4 py-2 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 disabled:opacity-50"
              >
                {creating ? "创建中..." : "创建任务"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 font-medium hover:bg-gray-300"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 状态筛选 */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">状态筛选:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "")}
          className="border rounded px-3 py-2"
        >
          <option value="">全部</option>
          <option value="pending">等待中</option>
          <option value="processing">处理中</option>
          <option value="completed">已完成</option>
          <option value="failed">失败</option>
          <option value="cancelled">已取消</option>
        </select>
      </div>

      {/* 任务列表 */}
      <div className="border rounded-lg overflow-hidden">
        {loading && tasks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">暂无任务</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  任务ID
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  操作类型
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  进度
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  创建时间
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {task.task_id}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {task.operations.map((op) => (
                        <span
                          key={op}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                        >
                          {op === "translate"
                            ? "翻译"
                            : op === "polish"
                            ? "润色"
                            : op === "fill_missing"
                            ? "填漏"
                            : op === "category_tags"
                            ? "分类标签"
                            : op}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                        task.status
                      )}`}
                    >
                      {getStatusText(task.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {task.status === "processing" || task.status === "completed" ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span>
                            {task.processed_count} / {task.total_questions}
                          </span>
                          <span>{getProgress(task)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${getProgress(task)}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500">
                          成功: {task.succeeded_count} | 失败: {task.failed_count}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(task.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedTask(task)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        查看详情
                      </button>
                      {(task.status === "pending" || task.status === "processing") && (
                        <button
                          onClick={() => handleCancelTask(task.task_id)}
                          disabled={cancellingTaskId === task.task_id}
                          className="text-orange-600 hover:text-orange-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {cancellingTaskId === task.task_id ? "取消中..." : "取消"}
                        </button>
                      )}
                      {(task.status === "completed" || task.status === "failed" || task.status === "cancelled") && (
                        <button
                          onClick={() => handleDeleteTask(task.task_id)}
                          disabled={deletingTaskId === task.task_id}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingTaskId === task.task_id ? "删除中..." : "删除"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 任务详情弹窗 */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">任务详情</h2>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">任务ID</label>
                    <p className="mt-1 text-sm">
                      <code className="bg-gray-100 px-2 py-1 rounded">
                        {selectedTask.task_id}
                      </code>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">状态</label>
                    <p className="mt-1">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                          selectedTask.status
                        )}`}
                      >
                        {getStatusText(selectedTask.status)}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      操作类型
                    </label>
                    <p className="mt-1">
                      {selectedTask.operations.join(", ")}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      总题目数
                    </label>
                    <p className="mt-1 text-sm">{selectedTask.total_questions}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      已处理
                    </label>
                    <p className="mt-1 text-sm">
                      {selectedTask.processed_count} / {selectedTask.total_questions} (
                      {getProgress(selectedTask)}%)
                    </p>
                    {selectedTask.status === "processing" && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${getProgress(selectedTask)}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          当前批次: {selectedTask.current_batch} / {Math.ceil(selectedTask.total_questions / 10)}
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      成功/失败
                    </label>
                    <p className="mt-1 text-sm">
                      {selectedTask.succeeded_count} / {selectedTask.failed_count}
                    </p>
                  </div>
                  {selectedTask.status === "processing" && (
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-700">
                        当前操作步骤
                      </label>
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-sm text-blue-800">
                          {selectedTask.operations.map((op, idx) => {
                            const opNames: Record<string, string> = {
                              translate: "翻译",
                              polish: "润色",
                              fill_missing: "填漏",
                              category_tags: "分类标签",
                            };
                            return (
                              <span key={op}>
                                {idx > 0 && " → "}
                                <span className="font-semibold">{opNames[op] || op}</span>
                              </span>
                            );
                          }).join("")}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          正在处理第 {selectedTask.processed_count + 1} 个题目...
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* AI 对话详情 */}
                  {selectedTask.status === "processing" && currentAiLogs.length > 0 && (
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-700">
                        AI 服务对话详情
                      </label>
                      <div className="mt-2 max-h-64 overflow-y-auto border rounded p-3 bg-gray-50">
                        {currentAiLogs.map((log: any, idx) => (
                          <div key={idx} className="mb-4 pb-4 border-b last:border-b-0">
                            <div className="text-xs text-gray-500 mb-1 flex items-center gap-2">
                              <span>{new Date(log.created_at).toLocaleString()}</span>
                              <span>·</span>
                              <span>{log.model}</span>
                              {log.operations && log.operations.length > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
                                    {log.operations.join(", ")}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="text-sm mb-2">
                              <div className="font-semibold text-gray-700 mb-1">提问：</div>
                              <div className="bg-white p-2 rounded border text-gray-800 whitespace-pre-wrap max-h-32 overflow-y-auto text-xs">
                                {log.question}
                              </div>
                            </div>
                            <div className="text-sm">
                              <div className="font-semibold text-gray-700 mb-1">回答：</div>
                              <div className="bg-blue-50 p-2 rounded border border-blue-200 text-gray-800 whitespace-pre-wrap max-h-48 overflow-y-auto text-xs">
                                {log.answer}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      创建时间
                    </label>
                    <p className="mt-1 text-sm">
                      {formatDate(selectedTask.created_at)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      开始时间
                    </label>
                    <p className="mt-1 text-sm">
                      {formatDate(selectedTask.started_at)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      完成时间
                    </label>
                    <p className="mt-1 text-sm">
                      {formatDate(selectedTask.completed_at)}
                    </p>
                  </div>
                </div>

                {/* 错误列表 */}
                {selectedTask.errors && selectedTask.errors.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      错误列表
                    </label>
                    <div className="mt-2 max-h-48 overflow-y-auto border rounded p-3 bg-red-50">
                      {selectedTask.errors.map((err, idx) => (
                        <div key={idx} className="text-sm text-red-700 mb-2">
                          <span className="font-medium">题目 {err.questionId}:</span>{" "}
                          {err.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 详情列表 */}
                {selectedTask.details && selectedTask.details.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      处理详情
                    </label>
                    <div className="mt-2 max-h-48 overflow-y-auto border rounded p-3 bg-gray-50">
                      {selectedTask.details.slice(0, 20).map((detail, idx) => (
                        <div key={idx} className="text-sm text-gray-700 mb-1">
                          题目 {detail.questionId}: {detail.operations.join(", ")} -{" "}
                          {detail.status}
                        </div>
                      ))}
                      {selectedTask.details.length > 20 && (
                        <div className="text-xs text-gray-500 mt-2">
                          还有 {selectedTask.details.length - 20} 条记录...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

