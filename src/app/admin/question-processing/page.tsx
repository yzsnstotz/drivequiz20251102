"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { apiFetch, apiPost, apiDelete, ApiError } from "@/lib/apiClient";
import { TaskErrorPanel } from "./_components/TaskErrorPanel";

type TaskStatus = "pending" | "processing" | "completed" | "failed" | "cancelled" | "succeeded";

type SubtaskDetail = {
  operation: string;
  scene: string;
  sceneName: string;
  prompt: string;
  expectedFormat: string | null;
  question: string;
  answer: string;
  status: "success" | "failed";
  error?: string;
  timestamp: string;
};

// ✅ 修复 Task 5：新的任务类型定义（任务粒度）
type TaskProgress = {
  totalItems: number;
  completedItems: number;
  failedItems: number;
  perOperation: Record<string, {
    total: number;
    succeeded: number;
    failed: number;
    processing: number;
    pending: number;
  }>;
};

type TaskListItem = {
  taskId: string;
  id: string; // 兼容字段
  createdAt: string;
  status: "pending" | "processing" | "succeeded" | "failed" | "completed" | "cancelled";
  questionCount: number;
  operations: string[];
  progress: TaskProgress;
};

type TaskItemsResponse = {
  items: Array<{
    id: number;
    taskId: string;
    questionId: number;
    operation: "translate" | "polish" | "fill_missing" | "category_tags" | "full_pipeline";
    targetLang: string | null;
    status: "pending" | "processing" | "succeeded" | "failed" | "skipped";
    errorMessage: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    // 📊 新增：调试数据字段
    aiRequest?: any;
    aiResponse?: any;
    processedData?: any;
    // ✅ A-4: 新增错误详情字段
    errorDetail?: any | null;
    // ✅ 添加请求体和回复体详情（兼容旧格式）
    requestBody: {
      prompt: string | null;
      question: string | null;
      expectedFormat: string | null;
      scene: string | null;
      sceneName: string | null;
    } | null;
    responseBody: {
      answer: string | null;
      aiProvider: string | null;
      model: string | null;
      status: string | null;
      error: string | null;
      timestamp: string | null;
    } | null;
  }>;
  total: number;
  limit: number;
  offset: number;
};

// 保留旧类型用于兼容
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
  details: Array<{ 
    questionId: number; 
    operations: string[]; 
    status: string;
    subtasks?: SubtaskDetail[]; // 子任务详细信息
    summary?: any; // 简报信息（如果存在）
  }> | null;
  summary?: {
    taskOverview: any;
    completionStatus: any;
    operationBreakdown: any;
    errorAnalysis: any;
    generatedAt: string;
  };
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type TasksResponse = {
  tasks: TaskListItem[];
  total: number;
  limit: number;
  offset: number;
};

export default function QuestionProcessingPage() {
  // 辅助函数：安全地提取 details 数组
  // details 可能是数组，也可能是对象（包含 server_logs 等字段）
  const getDetailsArray = useCallback((details: any): Array<any> => {
    if (!details) return [];
    if (Array.isArray(details)) return details;
    if (typeof details === 'object') {
      // 如果是对象，查找数组类型的字段（排除 server_logs）
      // 优先查找 'items' 字段（如果 appendServerLog 将数组转换为了对象）
      if (Array.isArray(details.items)) {
        return details.items;
      }
      // 查找其他数组字段（排除 server_logs）
      for (const key in details) {
        if (key !== 'server_logs' && Array.isArray(details[key])) {
          return details[key];
        }
      }
      // 如果没有找到数组字段，返回空数组
      return [];
    }
    return [];
  }, []);

  // ✅ 修复 Task 5：使用新的任务列表类型
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [processingLogs, setProcessingLogs] = useState<Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    taskId?: string;
    logType?: 'task-list' | 'task-processing'; // 区分任务列表日志和处理日志
  }>>([]);
  const [showLogs, setShowLogs] = useState(true);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskListItem | null>(null);
  const [selectedTaskItems, setSelectedTaskItems] = useState<TaskItemsResponse['items']>([]);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [loadingTaskItems, setLoadingTaskItems] = useState(false);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<number>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const detailRefreshRef = useRef<NodeJS.Timeout | null>(null);
  const [currentAiLogs, setCurrentAiLogs] = useState<Array<{ question: string; answer: string; model: string; created_at: string }>>([]);
  const errorCountRef = useRef<number>(0); // 错误计数
  const MAX_ERROR_COUNT = 3; // 连续失败 3 次后停止刷新
  const isManuallyClosedRef = useRef<boolean>(false); // 标记是否手动关闭弹窗

  // 从 localStorage 加载上一次的任务配置
  const loadCachedFormData = (): {
    questionIds: string;
    contentHashes: string[]; // ✅ 新增：content_hash 列表
    operations: string[];
    translateOptions: { from: string; to: string | string[] };
    polishOptions: { locale: string };
    fullPipelineOptions: { sourceLanguage: "zh" | "ja" | "en"; targetLanguages: string[]; type: "single" | "multiple" | "truefalse" }; // ✅ 修复：统一使用 type 字段
    batchSize: number;
    continueOnError: boolean;
  } => {
    try {
      const cached = localStorage.getItem('batch_process_task_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          questionIds: "", // 每次清空题目ID，让用户重新输入
          contentHashes: [], // ✅ 新增：每次清空 content_hash 列表
          operations: parsed.operations || [],
          translateOptions: parsed.translateOptions || { from: "zh", to: ["ja"] },
          polishOptions: parsed.polishOptions || { locale: "zh-CN" },
          fullPipelineOptions: parsed.fullPipelineOptions || { sourceLanguage: "zh", targetLanguages: ["ja"], type: "single" }, // ✅ 修复：使用 type 字段
          batchSize: parsed.batchSize || 10,
          continueOnError: parsed.continueOnError !== undefined ? parsed.continueOnError : true,
        };
      }
    } catch (error) {
      console.error('[loadCachedFormData] Failed to load cached form data:', error);
    }
    // 默认值
    return {
      questionIds: "",
      contentHashes: [], // ✅ 新增：默认空数组
      operations: [],
      translateOptions: { from: "zh", to: ["ja"] },
      polishOptions: { locale: "zh-CN" },
      fullPipelineOptions: { sourceLanguage: "zh", targetLanguages: ["ja"], type: "single" }, // ✅ 修复：使用 type 字段
      batchSize: 10,
      continueOnError: true,
    };
  };

  // 保存任务配置到 localStorage
  const saveCachedFormData = (data: {
    operations: string[];
    translateOptions: { from: string; to: string | string[] };
    polishOptions: { locale: string };
    fullPipelineOptions: { sourceLanguage: "zh" | "ja" | "en"; targetLanguages: string[]; type: "single" | "multiple" | "truefalse" }; // ✅ 修复：统一使用 type 字段
    batchSize: number;
    continueOnError: boolean;
  }) => {
    try {
      localStorage.setItem('batch_process_task_config', JSON.stringify(data));
      console.log('[saveCachedFormData] Task config saved to localStorage');
    } catch (error) {
      console.error('[saveCachedFormData] Failed to save cached form data:', error);
    }
  };

  // 创建任务表单状态
  const [formData, setFormData] = useState<{
    questionIds: string;
    contentHashes: string[]; // ✅ 新增：content_hash 列表
    operations: string[];
    translateOptions: { from: string; to: string | string[] };
    polishOptions: { locale: string };
    fullPipelineOptions: { sourceLanguage: "zh" | "ja" | "en"; targetLanguages: string[]; type: "single" | "multiple" | "truefalse" }; // ✅ 修复：统一使用 type 字段
    batchSize: number;
    continueOnError: boolean;
  }>({ ...loadCachedFormData(), contentHashes: [] });

  const loadTasks = useCallback(async (silent: boolean = false): Promise<BatchProcessTask[]> => {
    if (!silent) {
      setLoading(true);
    }
    // 清除之前的错误自动清除定时器
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    
    // 只在非静默模式下记录加载开始
    if (!silent) {
      setProcessingLogs(prev => {
        const newLogs = [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            level: 'info' as const,
            message: '📥 开始加载任务列表...',
            logType: 'task-list' as const,
          }
        ];
        return newLogs.slice(-200);
      });
    }
    
    try {
      // ✅ 修复 Task 5：使用新的任务列表 API
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "50");
      params.set("offset", "0");

      const response = await apiFetch<TasksResponse>(
        `/api/admin/question-processing/tasks?${params.toString()}`
      );

      if (response.data) {
        const loadedTasks = response.data.tasks || [];
        
        // 按创建时间倒序排序
        loadedTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        // 只在任务列表真正变化时才更新状态
        setTasks(prevTasks => {
          const prevTaskIds = new Set(prevTasks.map(t => t.taskId));
          const newTaskIds = new Set(loadedTasks.map(t => t.taskId));
          const taskIdsChanged = prevTaskIds.size !== newTaskIds.size || 
            !Array.from(prevTaskIds).every(id => newTaskIds.has(id));
          
          // 检查任务状态或进度是否有变化
          const statusChanged = prevTasks.some(prevTask => {
            const newTask = loadedTasks.find(t => t.taskId === prevTask.taskId);
            return !newTask || newTask.status !== prevTask.status || 
                   newTask.progress.completedItems !== prevTask.progress.completedItems;
          });
          
          // 如果任务列表或状态有变化，更新状态
          if (taskIdsChanged || statusChanged) {
            return loadedTasks;
          }
          return prevTasks; // 没有变化，返回原状态
        });
        
        // 只在非静默模式下记录加载成功
        if (!silent) {
          setProcessingLogs(prev => {
            const newLogs = [
              ...prev,
              {
                timestamp: new Date().toISOString(),
                level: 'info' as const,
                message: `✅ 任务列表加载成功: 共 ${loadedTasks.length} 个任务`,
                logType: 'task-list' as const,
              }
            ];
            return newLogs.slice(-200);
          });
        }
        
        // 返回兼容格式（用于向后兼容）
        return loadedTasks.map(task => ({
          id: 0,
          task_id: task.taskId,
          status: task.status as TaskStatus,
          operations: task.operations,
          question_ids: null,
          total_questions: task.questionCount,
          processed_count: task.progress.completedItems,
          succeeded_count: task.progress.completedItems - task.progress.failedItems,
          failed_count: task.progress.failedItems,
          current_batch: 0,
          errors: null,
          details: null,
          created_by: null,
          started_at: null,
          completed_at: null,
          created_at: task.createdAt,
          updated_at: task.createdAt,
        })) as any;
      } else {
        if (!silent) {
          setError("加载任务列表失败");
        }
        return [];
      }
    } catch (err) {
      const apiErr = err as ApiError;
      const errorMessage = apiErr.message || "加载任务列表失败";
      if (!silent) {
        setError(errorMessage);
        // 5秒后自动清除错误消息
        errorTimeoutRef.current = setTimeout(() => {
          setError(null);
          errorTimeoutRef.current = null;
        }, 5000);
      }
      return [];
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [statusFilter]); // 依赖 statusFilter

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // ✅ 修复 Task 5：加载任务详情（子任务列表）- 提前定义以避免初始化顺序问题
  const loadTaskItems = useCallback(async (taskId: string) => {
    setLoadingTaskItems(true);
    try {
      const response = await apiFetch<TaskItemsResponse>(
        `/api/admin/question-processing/tasks/${taskId}/items?limit=1000&offset=0`
      );
      if (response.data) {
        setSelectedTaskItems(response.data.items || []);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "加载任务详情失败");
    } finally {
      setLoadingTaskItems(false);
    }
  }, []);

  // ✅ 修复 Task 5：打开任务详情弹窗
  const handleOpenTaskDetail = useCallback(async (task: TaskListItem) => {
    setSelectedTask(task);
    setShowTaskDetailModal(true);
    await loadTaskItems(task.taskId);
  }, [loadTaskItems]);

  // 当打开创建表单时，从缓存恢复配置
  useEffect(() => {
    if (showCreateForm) {
      const cached = loadCachedFormData();
      setFormData(prev => ({
        ...prev,
        operations: cached.operations,
        translateOptions: cached.translateOptions,
        polishOptions: cached.polishOptions,
        batchSize: cached.batchSize,
        continueOnError: cached.continueOnError,
      }));
      console.log('[useEffect] Restored form data from cache:', cached);
    }
  }, [showCreateForm]);

  // 自动滚动日志到底部
  useEffect(() => {
    if (logsContainerRef.current && showLogs) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [processingLogs, showLogs]);

  // 加载当前任务的详细处理日志
  const loadProcessingLogs = async (taskId: string) => {
    try {
      const token = typeof window !== "undefined" ? window.localStorage.getItem("ADMIN_TOKEN") : null;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 秒超时
      
      try {
        const res = await fetch(`/api/admin/question-processing/processing-logs?taskId=${encodeURIComponent(taskId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const json = await res.json();
          if (json.ok && json.data?.logs) {
            // 将后端日志转换为前端日志格式
            const formattedLogs = json.data.logs.map((log: any) => ({
              timestamp: log.timestamp,
              level: log.level,
              message: log.message,
              questionId: log.questionId,
              operation: log.operation,
              aiProvider: log.aiProvider,
              logType: log.logType === 'server' ? 'task-processing' as const : 'task-processing' as const, // 服务器日志也显示为任务处理类型
              taskId: taskId, // 添加任务ID
            }));
            
            // 添加到处理日志中
            setProcessingLogs(prev => {
              // 合并日志，避免重复
              const existingMessages = new Set(prev.map(l => l.message));
              const newLogs = formattedLogs.filter((l: any) => !existingMessages.has(l.message));
              const combined = [...prev, ...newLogs];
              return combined.slice(-200); // 只保留最近200条
            });
          }
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name !== 'AbortError') {
          console.warn("[loadProcessingLogs] Request failed:", fetchError);
        }
      }
    } catch (e) {
      // 静默处理错误
      console.error("Failed to load processing logs:", e);
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
        console.log('[Frontend] [checkAndRefresh] Starting refresh check...');
        // 先加载最新任务列表（静默模式，避免产生过多日志）
        const latestTasks = await loadTasks(true);
        console.log('[Frontend] [checkAndRefresh] Loaded tasks:', latestTasks.length, latestTasks.map(t => ({
          task_id: t.task_id.substring(0, 8),
          status: t.status,
          processed: t.processed_count,
          total: t.total_questions
        })));
        
        // 重置错误计数（成功加载）
        errorCountRef.current = 0;
        
        // ✅ 修复 Task 5：如果任务详情窗口打开且未被手动关闭，更新选中的任务（使用新的任务列表格式）
        if (selectedTask && !isManuallyClosedRef.current) {
          const updatedTask = tasks.find(t => t.taskId === selectedTask.taskId);
          if (updatedTask) {
            console.log('[Frontend] [checkAndRefresh] Selected task updated:', {
              taskId: updatedTask.taskId.substring(0, 8),
              status: updatedTask.status,
              completedItems: updatedTask.progress.completedItems,
              totalItems: updatedTask.progress.totalItems
            });
            setSelectedTask(updatedTask);
            // 如果任务已完成、失败或取消，停止刷新
            if (updatedTask.status === "completed" || updatedTask.status === "failed" || updatedTask.status === "cancelled" || updatedTask.status === "succeeded") {
              console.log('[Frontend] [checkAndRefresh] Task finished, stopping refresh');
              if (detailRefreshRef.current) {
                clearInterval(detailRefreshRef.current);
                detailRefreshRef.current = null;
              }
              return;
            }
            // 如果任务正在处理，刷新子任务列表
            if (updatedTask.status === "processing") {
              console.log('[Frontend] [checkAndRefresh] Task still processing, refreshing task items...');
              loadTaskItems(updatedTask.taskId).catch((e) => {
                console.error("Failed to load task items:", e);
              });
            }
          }
        }
        
        // ✅ 修复 Task 5：检查是否有正在处理的任务（使用新的任务列表格式）
        const processingTasks = tasks.filter(
          (t) => t.status === "pending" || t.status === "processing"
        );
        console.log('[Frontend] [checkAndRefresh] Processing tasks found:', processingTasks.length);
        
        // 为每个正在处理的任务添加日志（只在进度变化时）
        processingTasks.forEach(task => {
          setProcessingLogs(prev => {
            // 检查是否已经有这个任务的最新日志
            const lastLog = prev.filter(l => l.taskId === task.taskId && l.message.includes('进度:')).pop();
            const currentProgress = `${task.progress.completedItems}/${task.progress.totalItems} (${getProgress(task)}%)`;
            
            // 如果进度没有变化，不添加新日志
            if (lastLog && lastLog.message.includes(currentProgress)) {
              return prev;
            }
            
            const statusEmoji = task.status === 'processing' ? '⚙️' : '⏳';
            const newLogs = [
              ...prev,
              {
                timestamp: new Date().toISOString(),
                level: 'info' as const,
                message: `${statusEmoji} 任务 ${task.taskId.substring(0, 8)}... 进度: ${currentProgress} | 成功: ${task.progress.completedItems - task.progress.failedItems} | 失败: ${task.progress.failedItems}`,
                taskId: task.taskId,
                logType: 'task-processing' as const,
              }
            ];
            // 只保留最近200条日志
            return newLogs.slice(-200);
          });
        });

        if (processingTasks.length === 0) {
          // 没有正在处理的任务，停止自动刷新
          setAutoRefresh(false);
          setProcessingLogs(prev => {
            const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'succeeded');
            const failedTasks = tasks.filter(t => t.status === 'failed');
            const newLogs = [
              ...prev,
              {
                timestamp: new Date().toISOString(),
                level: 'info' as const,
                message: `✅ 所有任务已完成 | 已完成: ${completedTasks.length} | 失败: ${failedTasks.length} | 停止自动刷新`,
                logType: 'task-processing' as const,
              }
            ];
            return newLogs.slice(-200);
          });
          return;
        }

        // 检查是否有任务长时间没有更新（超过 5 分钟）
        const now = Date.now();
        const STUCK_TIMEOUT = 5 * 60 * 1000; // 5 分钟
        
        // ✅ 修复 Task 5：检查任务是否卡住（使用新的任务列表格式）
        const hasStuckTasks = processingTasks.some((task) => {
          const taskCreatedAt = task.createdAt ? new Date(task.createdAt).getTime() : now;
          const timeSinceTaskCreate = now - taskCreatedAt;
          
          // 如果任务创建时间超过 5 分钟且仍在处理中，认为任务可能卡住了
          if (timeSinceTaskCreate > STUCK_TIMEOUT && task.status === "processing") {
            return true;
          }
          
          return false;
        });

        if (hasStuckTasks) {
          console.warn("[BatchProcess] 检测到任务可能卡住（超过 5 分钟未更新），停止自动刷新");
          setAutoRefresh(false);
          setProcessingLogs(prev => {
            const newLogs = [
              ...prev,
              {
                timestamp: new Date().toISOString(),
                level: 'warn' as const,
                message: '⚠️ 检测到任务可能卡住（超过 5 分钟未更新），已停止自动刷新',
                logType: 'task-processing' as const,
              }
            ];
            return newLogs.slice(-200);
          });
          return;
        }
      } catch (e) {
        // 错误处理：增加错误计数
        errorCountRef.current += 1;
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("[BatchProcess] 刷新任务列表失败:", e);
        
        // 添加错误日志
        setProcessingLogs(prev => {
          const newLogs = [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              level: 'error' as const,
              message: `刷新任务列表失败: ${errorMessage}`,
              logType: 'task-list' as const,
            }
          ];
          return newLogs.slice(-100);
        });
        
        // 如果连续失败超过最大次数，停止自动刷新
        if (errorCountRef.current >= MAX_ERROR_COUNT) {
          console.error(`[BatchProcess] 连续失败 ${MAX_ERROR_COUNT} 次，停止自动刷新`);
          setAutoRefresh(false);
          setProcessingLogs(prev => {
            const newLogs = [
              ...prev,
              {
                timestamp: new Date().toISOString(),
                level: 'error' as const,
                message: `连续失败 ${MAX_ERROR_COUNT} 次，停止自动刷新`,
                logType: 'task-list' as const,
              }
            ];
            return newLogs.slice(-200);
          });
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
  }, [autoRefresh, selectedTask?.taskId ?? null, tasks, loadTasks, loadTaskItems]); // 包含 loadTasks 和 loadTaskItems 依赖

  // 当任务详情窗口打开时，自动刷新该任务
  useEffect(() => {
    // 使用 ref 来跟踪是否应该继续刷新
    let shouldRefresh = true;
    
    if (!selectedTask) {
      if (detailRefreshRef.current) {
        clearInterval(detailRefreshRef.current);
        detailRefreshRef.current = null;
      }
      shouldRefresh = false;
      return;
    }

    // ✅ 修复 Task 5：使用新的任务格式（兼容旧弹窗）
    const taskId = selectedTask.taskId || (selectedTask as any).task_id; // 保存 taskId 到局部变量

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
          const latestTasks = await loadTasks(true); // 静默模式，避免产生过多日志
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
              if (current && current.taskId === taskId) {
                // 将 BatchProcessTask 转换为 TaskListItem
                return {
                  taskId: updatedTask.task_id,
                  id: String(updatedTask.id),
                  createdAt: updatedTask.created_at,
                  status: updatedTask.status as "pending" | "processing" | "succeeded" | "failed" | "completed" | "cancelled",
                  questionCount: updatedTask.total_questions,
                  operations: updatedTask.operations,
                  progress: {
                    totalItems: updatedTask.total_questions,
                    completedItems: updatedTask.processed_count,
                    failedItems: updatedTask.failed_count,
                    perOperation: {},
                  },
                };
              }
              return current;
            });
            
            // 加载详细处理日志（不阻塞，失败也不影响主流程）
            loadProcessingLogs(taskId).catch((e) => {
              console.error("Failed to load processing logs:", e);
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
    }, [selectedTask?.taskId ?? null, selectedTask?.status ?? null, tasks, loadTasks, loadTaskItems]); // 使用新的任务格式

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

      // 处理题目ID 或 content_hash（优先使用 content_hash）
      if (formData.contentHashes && formData.contentHashes.length > 0) {
        // ✅ 新增：优先使用 content_hash 列表
        payload.contentHashes = formData.contentHashes;
      } else if (formData.questionIds) {
        // 如果没有 content_hash，则使用 questionIds
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
      if (formData.operations.includes("full_pipeline")) {
        if (!formData.fullPipelineOptions) {
          // 如果 fullPipelineOptions 不存在，使用默认值
          payload.fullPipelineOptions = {
            sourceLanguage: "zh",
            targetLanguages: ["ja"],
            type: "single", // ✅ 修复：使用 type 字段
          };
        } else {
          payload.fullPipelineOptions = formData.fullPipelineOptions;
        }
      }

      // 批量处理任务创建可能需要较长时间（加载题目等），增加超时时间到 60 秒
      const response = await apiPost<{ taskId?: string; task_id?: string }>(
        "/api/admin/question-processing/batch-process",
        payload,
        { timeoutMs: 60_000 } // 60 秒超时
      );

      // apiPost 直接返回 data，不是包装对象
      // API返回的是 taskId 或 task_id
      const taskId = response?.taskId || response?.task_id;
      
      console.log('[handleCreateTask] Task created, taskId:', taskId, 'response:', response);
      
      if (!taskId) {
        console.error('[handleCreateTask] ❌ Task ID is missing! Response:', response);
        throw new Error('任务创建成功但未返回任务ID');
      }

      // ✅ 问题3修复：任务创建成功后，保存当前配置到 localStorage
      saveCachedFormData({
        operations: formData.operations,
        translateOptions: formData.translateOptions,
        polishOptions: formData.polishOptions,
        fullPipelineOptions: formData.fullPipelineOptions,
        batchSize: formData.batchSize,
        continueOnError: formData.continueOnError,
      });
      console.log("[question-processing] 批量配置已保存到 localStorage");
      
      setShowCreateForm(false);
      // 重置表单，但保留配置（下次打开时会从缓存加载）
      setFormData({
        questionIds: "",
        contentHashes: [], // ✅ 新增：清空 content_hash 列表
        operations: formData.operations, // 保留操作类型
        translateOptions: formData.translateOptions, // 保留翻译选项
        polishOptions: formData.polishOptions, // 保留润色选项
        fullPipelineOptions: formData.fullPipelineOptions, // 保留完整流程选项
        batchSize: formData.batchSize, // 保留批次大小
        continueOnError: formData.continueOnError, // 保留错误处理选项
      });
      
      await loadTasks();
      setAutoRefresh(true);
      setProcessingLogs(prev => {
        const newLogs = [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            level: 'info' as const,
            message: `✅ 任务创建成功: ${taskId || 'unknown'}`,
            taskId: taskId,
            logType: 'task-processing' as const,
          },
          {
            timestamp: new Date().toISOString(),
            level: 'info' as const,
            message: `🔄 已启动自动刷新，将每5秒更新一次任务状态`,
            taskId: taskId,
            logType: 'task-processing' as const,
          }
        ];
        return newLogs.slice(-200);
      });
    } catch (err) {
      const apiErr = err as ApiError;
      const errorMessage = apiErr.message || "创建任务失败";
      setError(errorMessage);
      setProcessingLogs(prev => {
        const newLogs = [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            level: 'error' as const,
            message: `创建任务失败: ${errorMessage}`,
            logType: 'task-processing' as const,
          }
        ];
        return newLogs.slice(-100);
      });
      // 5秒后自动清除错误消息
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = setTimeout(() => {
        setError(null);
        errorTimeoutRef.current = null;
      }, 5000);
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

  const getProgress = (task: TaskListItem) => {
    if (task.progress.totalItems === 0) return 0;
    return Math.round((task.progress.completedItems / task.progress.totalItems) * 100);
  };

  const handleCancelTask = async (taskId: string) => {
    // ✅ 修复：先检查任务状态，避免尝试取消已完成的任务
    const task = tasks.find(t => t.taskId === taskId);
    if (task) {
      const finalStatuses = ["completed", "failed", "cancelled", "succeeded"];
      if (finalStatuses.includes(task.status)) {
        setError(`无法取消任务：任务状态为 "${getStatusText(task.status as TaskStatus)}"，只能取消等待中或处理中的任务。`);
        return;
      }
    }

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
      // 显示成功消息
      setProcessingLogs(prev => {
        const newLogs = [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            level: 'info' as const,
            message: `✅ 任务 ${taskId.substring(0, 8)}... 已取消`,
            taskId: taskId,
            logType: 'task-processing' as const,
          }
        ];
        return newLogs.slice(-200);
      });
    } catch (err) {
      const apiErr = err as ApiError;
      // ✅ 改进错误处理：提供更友好的错误信息
      let errorMessage = apiErr.message || "取消任务失败";
      
      // 如果错误信息包含状态相关的提示，提供更友好的说明
      if (errorMessage.includes("cannot be cancelled") || errorMessage.includes("Current status")) {
        errorMessage = `无法取消任务：任务可能已经完成或失败。只能取消等待中或处理中的任务。`;
      }
      
      setError(errorMessage);
      setProcessingLogs(prev => {
        const newLogs = [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            level: 'error' as const,
            message: `❌ 取消任务失败: ${errorMessage}`,
            taskId: taskId,
            logType: 'task-processing' as const,
          }
        ];
        return newLogs.slice(-200);
      });
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
            onClick={() => loadTasks(false)}
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
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => {
              setError(null);
              if (errorTimeoutRef.current) {
                clearTimeout(errorTimeoutRef.current);
                errorTimeoutRef.current = null;
              }
            }}
            className="ml-4 text-red-700 hover:text-red-900"
          >
            ✕
          </button>
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
                  { value: "full_pipeline", label: "一体化处理" }, // 新增：一体化处理
                ].map((op) => (
                  <label key={op.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.operations.includes(op.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          // 如果选择 full_pipeline，确保 fullPipelineOptions 存在
                          const newOperations = [...formData.operations, op.value];
                          const newFormData: any = {
                            ...formData,
                            operations: newOperations,
                          };
                          if (op.value === "full_pipeline" && !formData.fullPipelineOptions) {
                            newFormData.fullPipelineOptions = {
                              sourceLanguage: "zh",
                              targetLanguages: ["ja"],
                              type: "single", // ✅ 修复：使用 type 字段
                            };
                          }
                          setFormData(newFormData);
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

            {/* ✅ 新增：文件上传功能 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                或上传待运行题目文件（content_hash列表）
              </label>
              <input
                type="file"
                accept=".md,.txt"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  try {
                    const text = await file.text();
                    // 解析文件内容，提取 content_hash（每行一个）
                    const hashes = text
                      .split('\n')
                      .map(line => line.trim())
                      .filter(line => line.length > 0 && /^[a-f0-9]{64}$/i.test(line)); // 验证是64位十六进制字符串

                    if (hashes.length === 0) {
                      setError('文件中没有找到有效的 content_hash（应为64位十六进制字符串，每行一个）');
                      return;
                    }

                    setFormData({ ...formData, contentHashes: hashes, questionIds: "" }); // 清空 questionIds
                    setProcessingLogs(prev => [...prev.slice(-199), {
                      timestamp: new Date().toISOString(),
                      level: 'info',
                      message: `✅ 已加载 ${hashes.length} 个 content_hash`,
                      logType: 'task-list',
                    }]);
                  } catch (error) {
                    setError(`读取文件失败: ${error instanceof Error ? error.message : String(error)}`);
                  }
                }}
                className="w-full border rounded px-3 py-2"
              />
              {formData.contentHashes.length > 0 && (
                <p className="text-xs text-green-600 mt-1">
                  ✅ 已加载 {formData.contentHashes.length} 个 content_hash
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                上传&quot;指令模版/待运行题目.md&quot;文件，文件应包含每行一个 content_hash（64位十六进制字符串）
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

            {/* 一体化处理选项 */}
            {formData.operations.includes("full_pipeline") && formData.fullPipelineOptions && (
              <div className="border-l-4 border-purple-500 pl-4 space-y-3 mt-4">
                <h3 className="font-medium text-purple-700">一体化处理选项</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">源语言</label>
                    <select
                      value={formData.fullPipelineOptions?.sourceLanguage || "zh"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fullPipelineOptions: {
                            ...(formData.fullPipelineOptions || { sourceLanguage: "zh", targetLanguages: ["ja"], type: "single" }), // ✅ 修复：使用 type 字段
                            sourceLanguage: e.target.value as "zh" | "ja" | "en",
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
                    <label className="block text-sm font-medium mb-1">题目类型</label>
                    <select
                      value={formData.fullPipelineOptions?.type || "single"} // ✅ 修复：使用 type 字段
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fullPipelineOptions: {
                            ...(formData.fullPipelineOptions || { sourceLanguage: "zh", targetLanguages: ["ja"], type: "single" }), // ✅ 修复：使用 type 字段
                            type: e.target.value as "single" | "multiple" | "truefalse", // ✅ 修复：使用 type 字段
                          },
                        })
                      }
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="single">单选题</option>
                      <option value="multiple">多选题</option>
                      <option value="truefalse">判断题</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    目标语言 <span className="text-purple-600 font-semibold">(可多选)</span>
                  </label>
                  <div className="space-y-2 border-2 border-purple-300 rounded-lg px-3 py-3 min-h-[120px] max-h-[180px] overflow-y-auto bg-purple-50">
                    {[
                      { value: "zh", label: "中文 (zh)" },
                      { value: "ja", label: "日文 (ja)" },
                      { value: "en", label: "英文 (en)" },
                    ].map((lang) => {
                      const isChecked = (formData.fullPipelineOptions?.targetLanguages || []).includes(lang.value);
                      return (
                        <label key={lang.value} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-purple-100 rounded">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const current = formData.fullPipelineOptions?.targetLanguages || ["ja"];
                              let newLanguages: string[];
                              if (e.target.checked) {
                                newLanguages = [...current, lang.value];
                              } else {
                                newLanguages = current.filter((l) => l !== lang.value);
                                if (newLanguages.length === 0) {
                                  newLanguages = [lang.value];
                                }
                              }
                              setFormData({
                                ...formData,
                                fullPipelineOptions: {
                                  ...(formData.fullPipelineOptions || { sourceLanguage: "zh", targetLanguages: ["ja"], type: "single" }), // ✅ 修复：使用 type 字段
                                  targetLanguages: newLanguages,
                                },
                              });
                            }}
                            className="rounded w-4 h-4 text-purple-600"
                          />
                          <span className="text-sm font-medium">{lang.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-purple-600 font-medium mt-2">
                    ✓ 已选择: {(formData.fullPipelineOptions?.targetLanguages || []).join(", ")}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  一体化处理将执行：润色题干 + 补漏选项/解析 + 生成标签 + 多语言翻译
                </p>
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
                <tr key={task.taskId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {task.taskId.length > 20 ? `${task.taskId.substring(0, 20)}...` : task.taskId}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {task.operations.map((op) => (
                        <span
                          key={op}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                        >
                          {op === "full_pipeline"
                            ? "一体化"
                            : op === "translate"
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
                        task.status as TaskStatus
                      )}`}
                    >
                      {getStatusText(task.status as TaskStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {task.status === "processing" || task.status === "completed" || task.status === "succeeded" || task.status === "failed" ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span>
                            {task.progress.completedItems} / {task.progress.totalItems}
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
                           成功: {(task.progress.completedItems ?? 0) - (task.progress.failedItems ?? 0)} | 失败: {task.progress.failedItems ?? 0} | 题目数: {task.questionCount ?? 0}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(task.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenTaskDetail(task)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        查看详情
                      </button>
                      {(task.status === "pending" || task.status === "processing") && (
                        <button
                          onClick={() => handleCancelTask(task.taskId)}
                          disabled={cancellingTaskId === task.taskId || task.status !== "pending" && task.status !== "processing"}
                          className="text-orange-600 hover:text-orange-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={task.status !== "pending" && task.status !== "processing" ? "只能取消等待中或处理中的任务" : "取消任务"}
                        >
                          {cancellingTaskId === task.taskId ? "取消中..." : "取消"}
                        </button>
                      )}
                      {(task.status === "completed" || task.status === "failed" || task.status === "cancelled" || task.status === "succeeded") && (
                        <button
                          onClick={() => handleDeleteTask(task.taskId)}
                          disabled={deletingTaskId === task.taskId}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingTaskId === task.taskId ? "删除中..." : "删除"}
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

      {/* 实时日志展示卡片 */}
      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">实时处理日志</h2>
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              {showLogs ? "隐藏" : "显示"}
            </button>
            <button
              onClick={() => setProcessingLogs([])}
              className="text-sm text-red-600 hover:text-red-800"
            >
              清空日志
            </button>
            <button
              onClick={async () => {
                try {
                  // 格式化所有日志
                  const logText = processingLogs.map(log => {
                    const time = new Date(log.timestamp).toLocaleString('zh-CN');
                    const level = log.level.toUpperCase();
                    const logType = log.logType === 'task-list' ? '任务列表' : log.logType === 'task-processing' ? '任务处理' : '';
                    const taskId = log.taskId ? `Task: ${log.taskId.substring(0, 8)}...` : '';
                    const questionId = (log as any).questionId ? `Q${(log as any).questionId}` : '';
                    const aiProvider = (log as any).aiProvider || '';
                    
                    const parts = [
                      `[${time}]`,
                      `[${level}]`,
                      logType ? `[${logType}]` : '',
                      taskId ? `[${taskId}]` : '',
                      questionId ? `[${questionId}]` : '',
                      aiProvider ? `[${aiProvider}]` : '',
                      log.message
                    ].filter(Boolean);
                    
                    return parts.join(' ');
                  }).join('\n');
                  
                  await navigator.clipboard.writeText(logText);
                  setCopySuccess(true);
                  setTimeout(() => setCopySuccess(false), 2000);
                } catch (err) {
                  console.error('Failed to copy logs:', err);
                  // 降级方案：使用传统方法
                  const textArea = document.createElement('textarea');
                  textArea.value = processingLogs.map(log => {
                    const time = new Date(log.timestamp).toLocaleString('zh-CN');
                    const level = log.level.toUpperCase();
                    const logType = log.logType === 'task-list' ? '任务列表' : log.logType === 'task-processing' ? '任务处理' : '';
                    const taskId = log.taskId ? `Task: ${log.taskId.substring(0, 8)}...` : '';
                    const questionId = (log as any).questionId ? `Q${(log as any).questionId}` : '';
                    const aiProvider = (log as any).aiProvider || '';
                    
                    const parts = [
                      `[${time}]`,
                      `[${level}]`,
                      logType ? `[${logType}]` : '',
                      taskId ? `[${taskId}]` : '',
                      questionId ? `[${questionId}]` : '',
                      aiProvider ? `[${aiProvider}]` : '',
                      log.message
                    ].filter(Boolean);
                    
                    return parts.join(' ');
                  }).join('\n');
                  textArea.style.position = 'fixed';
                  textArea.style.opacity = '0';
                  document.body.appendChild(textArea);
                  textArea.select();
                  document.execCommand('copy');
                  document.body.removeChild(textArea);
                  setCopySuccess(true);
                  setTimeout(() => setCopySuccess(false), 2000);
                }
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {copySuccess ? '✅ 已复制' : '📋 复制全部日志'}
            </button>
          </div>
          <div className="text-sm text-gray-500">
            日志数量: {processingLogs.length}
          </div>
        </div>
        {showLogs && (
          <div className="p-4">
            <div 
              ref={logsContainerRef}
              className="bg-gray-900 text-green-400 font-mono text-xs rounded-lg p-4 max-h-96 overflow-y-auto"
            >
              {processingLogs.length === 0 ? (
                <div className="text-gray-500">暂无日志，等待任务处理...</div>
              ) : (
                processingLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`mb-1 ${
                      log.level === 'error'
                        ? 'text-red-400'
                        : log.level === 'warn'
                        ? 'text-yellow-400'
                        : 'text-green-400'
                    }`}
                  >
                    <span className="text-gray-500">
                      [{new Date(log.timestamp).toLocaleTimeString('zh-CN')}]
                    </span>
                    <span className="ml-2">
                      [{log.level.toUpperCase()}]
                    </span>
                    {log.logType && (
                      <span className={`ml-2 ${
                        log.logType === 'task-list' 
                          ? 'text-gray-400' 
                          : log.message.includes('🔥') || log.message.includes('processBatchAsync') || log.message.includes('STARTED') || log.message.includes('About to call')
                          ? 'text-yellow-400 font-bold'
                          : 'text-blue-400'
                      }`}>
                        [{log.logType === 'task-list' 
                          ? '任务列表' 
                          : log.message.includes('🔥') || log.message.includes('processBatchAsync') || log.message.includes('STARTED') || log.message.includes('About to call')
                          ? '服务器日志'
                          : '任务处理'}]
                      </span>
                    )}
                    {log.taskId && (
                      <span className="ml-2 text-blue-400">
                        [Task: {log.taskId.substring(0, 8)}...]
                      </span>
                    )}
                    {(log as any).questionId && (
                      <span className="ml-2 text-cyan-400">
                        [Q{(log as any).questionId}]
                      </span>
                    )}
                    {(log as any).aiProvider && (
                      <span className="ml-2 text-purple-400">
                        [{(log as any).aiProvider}]
                      </span>
                    )}
                    <span className="ml-2">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
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
                  onClick={() => {
                    isManuallyClosedRef.current = true; // 标记为手动关闭
                    setSelectedTask(null);
                  }}
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
                        {selectedTask.taskId}
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
                     <p className="mt-1 text-sm">{selectedTask.questionCount}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      已处理
                    </label>
                    <p className="mt-1 text-sm">
                      {selectedTask.progress.completedItems} / {selectedTask.questionCount} (
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
                          当前批次: {Math.ceil(selectedTask.progress.completedItems / 10)} / {Math.ceil(selectedTask.questionCount / 10)}
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      成功/失败
                    </label>
                    <p className="mt-1 text-sm">
                      {(selectedTask.progress.completedItems - selectedTask.progress.failedItems)} / {selectedTask.progress.failedItems}
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
                          正在处理第 {selectedTask.progress.completedItems + 1} 个题目...
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* AI 对话详情 - 从子任务详细信息中显示 */}
                  {(() => {
                    const detailsArray = getDetailsArray((selectedTask as any).details);
                    const validDetails = detailsArray.filter((d: any) => d && !d.summary && d.subtasks && Array.isArray(d.subtasks) && d.subtasks.length > 0);
                    return validDetails.length > 0;
                  })() && (
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-700">
                        AI 服务对话详情（所有操作）
                      </label>
                      <div className="mt-2 max-h-96 overflow-y-auto border rounded p-3 bg-gray-50 space-y-4">
                        {getDetailsArray((selectedTask as any).details)
                          .filter((d: any) => d && !d.summary && d.subtasks && Array.isArray(d.subtasks) && d.subtasks.length > 0)
                          .map((detail: any, detailIdx: number) => (
                            <div key={detailIdx} className="border-b border-gray-200 pb-4 last:border-b-0">
                              <div className="text-xs font-semibold text-gray-800 mb-2">
                                题目 {detail.questionId}: {detail.operations.join(", ")} - {detail.status}
                              </div>
                              {detail.subtasks.map((subtask: SubtaskDetail, subtaskIdx: number) => (
                                <div key={subtaskIdx} className="ml-4 mb-3 bg-white rounded-lg p-3 border border-gray-200">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-medium">
                                        {subtask.operation}
                                      </span>
                                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                                        {subtask.sceneName}
                                      </span>
                                      <span className={`px-2 py-1 text-xs rounded ${
                                        subtask.status === "success" 
                                          ? "bg-green-100 text-green-800" 
                                          : "bg-red-100 text-red-800"
                                      }`}>
                                        {subtask.status === "success" ? "成功" : "失败"}
                                      </span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                      {new Date(subtask.timestamp).toLocaleString("zh-CN")}
                                    </span>
                                  </div>
                                  <div className="text-sm mb-2">
                                    <div className="font-semibold text-gray-700 mb-1">提问：</div>
                                    <div className="bg-white p-2 rounded border text-gray-800 whitespace-pre-wrap max-h-32 overflow-y-auto text-xs">
                                      {subtask.question}
                                    </div>
                                  </div>
                                  <div className="text-sm">
                                    <div className="font-semibold text-gray-700 mb-1">回答：</div>
                                    <div className={`p-2 rounded border text-gray-800 whitespace-pre-wrap max-h-48 overflow-y-auto text-xs ${
                                      subtask.status === "success"
                                        ? "bg-blue-50 border-blue-200"
                                        : "bg-red-50 border-red-200"
                                    }`}>
                                      {subtask.answer || (subtask.error ? `错误: ${subtask.error}` : "无回答")}
                                    </div>
                                  </div>
                                </div>
                              ))}
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
                      {formatDate(selectedTask.createdAt)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      开始时间
                    </label>
                    <p className="mt-1 text-sm">
                      {(selectedTask as any).started_at ? formatDate((selectedTask as any).started_at) : "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      完成时间
                    </label>
                    <p className="mt-1 text-sm">
                      {(selectedTask as any).completed_at ? formatDate((selectedTask as any).completed_at) : "-"}
                    </p>
                  </div>
                </div>

                {/* 错误信息面板（支持点击复制） */}
                {/* 从 selectedTaskItems 中收集错误信息，或从 selectedTask.errors 中获取（如果存在） */}
                <TaskErrorPanel 
                  errors={
                    // 优先使用 selectedTaskItems 中的错误信息
                    selectedTaskItems.length > 0
                      ? selectedTaskItems
                          .filter(item => item.errorMessage)
                          .map(item => ({
                            questionId: item.questionId,
                            error: item.errorMessage || ""
                          }))
                      : // 如果没有 selectedTaskItems，尝试从 (selectedTask as any).errors 获取（兼容旧数据结构）
                        (selectedTask as any)?.errors || null
                  }
                />

                {/* 任务完成简报 */}
                {selectedTask.status === "completed" && (selectedTask as any).summary && (
                  <div className="col-span-2 border-t pt-4 mt-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">任务完成简报</h3>
                    
                    {/* 任务概述 */}
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">任务概述</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">任务ID:</span>{" "}
                          <code className="text-xs bg-white px-1 rounded">{(selectedTask as any).summary.taskOverview.taskId}</code>
                        </div>
                        <div>
                          <span className="text-gray-600">操作类型:</span>{" "}
                          {(selectedTask as any).summary.taskOverview.operations.join(", ")}
                        </div>
                        <div>
                          <span className="text-gray-600">总题目数:</span> {(selectedTask as any).summary.taskOverview.totalQuestions}
                        </div>
                        <div>
                          <span className="text-gray-600">批次大小:</span> {(selectedTask as any).summary.taskOverview.batchSize}
                        </div>
                        {(selectedTask as any).summary.taskOverview.translateOptions && (
                          <div className="col-span-2">
                            <span className="text-gray-600">翻译选项:</span>{" "}
                            {(selectedTask as any).summary.taskOverview.translateOptions.from} →{" "}
                            {Array.isArray((selectedTask as any).summary.taskOverview.translateOptions.to)
                              ? (selectedTask as any).summary.taskOverview.translateOptions.to.join(", ")
                              : (selectedTask as any).summary.taskOverview.translateOptions.to}
                          </div>
                        )}
                        {(selectedTask as any).summary.taskOverview.polishOptions && (
                          <div>
                            <span className="text-gray-600">润色语言:</span> {(selectedTask as any).summary.taskOverview.polishOptions.locale}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 完成情况 */}
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-green-900 mb-2">完成情况（数据库核验）</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">已处理:</span> {(selectedTask as any).summary.completionStatus.processed}
                        </div>
                        <div>
                          <span className="text-gray-600">成功:</span>{" "}
                          <span className="text-green-700 font-semibold">
                            {(selectedTask as any).summary.completionStatus.succeeded}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">失败:</span>{" "}
                          <span className="text-red-700 font-semibold">
                            {(selectedTask as any).summary.completionStatus.failed}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">成功率:</span>{" "}
                          <span className="font-semibold">
                            {(selectedTask as any).summary.completionStatus.successRate.toFixed(2)}%
                          </span>
                        </div>
                        <div className="col-span-2 mt-2 pt-2 border-t border-green-300">
                          <div className="text-xs text-gray-600">
                            <div>数据库核验:</div>
                            <div className="mt-1">
                              实际处理: {(selectedTask as any).summary.completionStatus.verifiedFromDb.actualProcessed} |{" "}
                              实际成功: {(selectedTask as any).summary.completionStatus.verifiedFromDb.actualSucceeded} |{" "}
                              实际失败: {(selectedTask as any).summary.completionStatus.verifiedFromDb.actualFailed}
                            </div>
                            <div className={`mt-1 font-semibold ${
                              (selectedTask as any).summary.completionStatus.verifiedFromDb.matches ? "text-green-700" : "text-red-700"
                            }`}>
                              {(selectedTask as any).summary.completionStatus.verifiedFromDb.matches ? "✓ 数据一致" : "✗ 数据不一致"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 操作分解 */}
                    <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">操作分解</h4>
                      <div className="space-y-2">
                        {Object.entries((selectedTask as any).summary.operationBreakdown).map(([op, stats]: [string, any]) => (
                          <div key={op} className="text-sm">
                            <div className="font-medium text-gray-700 mb-1">
                              {op === "translate" ? "翻译" : op === "polish" ? "润色" : op === "fill_missing" ? "填漏" : op === "category_tags" ? "分类标签" : op}
                            </div>
                            <div className="ml-4 text-xs text-gray-600">
                              尝试: {stats.attempted} | 成功: {stats.succeeded} | 失败: {stats.failed}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 错误分析 */}
                    {(selectedTask as any).summary.errorAnalysis.totalErrors > 0 && (
                      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <h4 className="text-sm font-semibold text-red-900 mb-2">错误分析</h4>
                        <div className="text-sm">
                          <div className="mb-2">
                            <span className="text-gray-600">总错误数:</span> {(selectedTask as any).summary.errorAnalysis.totalErrors}
                          </div>
                          <div className="mb-2">
                            <span className="text-gray-600">错误类型数:</span> {(selectedTask as any).summary.errorAnalysis.uniqueErrorTypes.length}
                          </div>
                          {(selectedTask as any).summary.errorAnalysis.topErrors.length > 0 && (
                            <div>
                              <div className="text-gray-600 mb-1">主要错误:</div>
                              <ul className="ml-4 space-y-1 text-xs">
                                {(selectedTask as any).summary.errorAnalysis.topErrors.map((err: any, idx: number) => (
                                  <li key={idx}>
                                    {err.error} ({err.count} 次)
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-gray-500 mt-2">
                      简报生成时间: {new Date((selectedTask as any).summary.generatedAt).toLocaleString()}
                    </div>
                  </div>
                )}

                {/* 详情列表 */}
                {(() => {
                  const detailsArray = getDetailsArray((selectedTask as any).details);
                  const validDetails = detailsArray.filter((d: any) => d && !d.summary);
                  return validDetails.length > 0;
                })() && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      处理详情（包含子任务级别的AI对答追踪）
                    </label>
                    <div className="mt-2 max-h-96 overflow-y-auto border rounded p-3 bg-gray-50 space-y-4">
                      {getDetailsArray((selectedTask as any).details)
                        .filter((d: any) => d && !d.summary)
                        .slice(0, 10)
                        .map((detail, idx) => (
                        <div key={idx} className="border-b border-gray-200 pb-4 last:border-b-0">
                          <div className="text-sm font-semibold text-gray-800 mb-2">
                            题目 {detail.questionId}: {detail.operations.join(", ")} - {detail.status}
                          </div>
                          
                          {/* 子任务详细信息 */}
                          {detail.subtasks && detail.subtasks.length > 0 && (
                            <div className="ml-4 space-y-3 mt-2">
                              {detail.subtasks.map((subtask: any, subtaskIdx: number) => (
                                <div key={subtaskIdx} className="bg-white rounded-lg p-3 border border-gray-200">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-medium">
                                        {subtask.operation}
                                      </span>
                                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                                        {subtask.sceneName}
                                      </span>
                                      <span className={`px-2 py-1 text-xs rounded ${
                                        subtask.status === "success" 
                                          ? "bg-green-100 text-green-800" 
                                          : "bg-red-100 text-red-800"
                                      }`}>
                                        {subtask.status === "success" ? "成功" : "失败"}
                                      </span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                      {new Date(subtask.timestamp).toLocaleString("zh-CN")}
                                    </span>
                                  </div>

                                  {/* 指令（Prompt） */}
                                  <div className="mb-3">
                                    <div className="text-xs font-semibold text-gray-700 mb-1">指令（Prompt）:</div>
                                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-gray-800 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                      {subtask.prompt || "未配置"}
                                    </div>
                                  </div>

                                  {/* 预期回答格式 */}
                                  {subtask.expectedFormat && (
                                    <div className="mb-3">
                                      <div className="text-xs font-semibold text-gray-700 mb-1">预期回答格式:</div>
                                      <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-gray-800 whitespace-pre-wrap max-h-24 overflow-y-auto">
                                        {subtask.expectedFormat}
                                      </div>
                                    </div>
                                  )}

                                  {/* 发送给AI的问题 */}
                                  <div className="mb-3">
                                    <div className="text-xs font-semibold text-gray-700 mb-1">发送给AI的问题:</div>
                                    <div className="bg-gray-50 border border-gray-200 rounded p-2 text-xs text-gray-800 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                      {subtask.question}
                                    </div>
                                  </div>

                                  {/* AI的回答 */}
                                  <div>
                                    <div className="text-xs font-semibold text-gray-700 mb-1">AI的回答:</div>
                                    <div className={`border rounded p-2 text-xs whitespace-pre-wrap max-h-48 overflow-y-auto ${
                                      subtask.status === "success"
                                        ? "bg-green-50 border-green-200 text-gray-800"
                                        : "bg-red-50 border-red-200 text-red-800"
                                    }`}>
                                      {subtask.answer || (subtask.error ? `错误: ${subtask.error}` : "无回答")}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {(() => {
                        const detailsArray = getDetailsArray((selectedTask as any).details);
                        return detailsArray.length > 10;
                      })() && (
                        <div className="text-xs text-gray-500 mt-2 text-center">
                          还有 {getDetailsArray((selectedTask as any).details).length - 10} 条记录...
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

      {/* ✅ 修复 Task 5：任务详情弹窗（展示子任务列表，含 questionId） */}
      {showTaskDetailModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">任务详情</h2>
              <button
                onClick={() => {
                  setShowTaskDetailModal(false);
                  setSelectedTask(null);
                  setSelectedTaskItems([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {/* 任务基本信息 */}
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">任务ID</label>
                  <div className="mt-1 text-sm text-gray-900 font-mono">{selectedTask.taskId}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">状态</label>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedTask.status as TaskStatus)}`}>
                      {getStatusText(selectedTask.status as TaskStatus)}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">创建时间</label>
                  <div className="mt-1 text-sm text-gray-900">{formatDate(selectedTask.createdAt)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">题目数量</label>
                  <div className="mt-1 text-sm text-gray-900">{selectedTask.questionCount}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">操作类型</label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedTask.operations.map((op) => (
                      <span key={op} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {op === "translate" ? "翻译" : op === "polish" ? "润色" : op === "fill_missing" ? "填漏" : op === "category_tags" ? "分类标签" : op}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">进度</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {selectedTask.progress.completedItems} / {selectedTask.progress.totalItems} 
                    ({getProgress(selectedTask)}%)
                  </div>
                </div>
              </div>

              {/* 错误信息面板（支持点击复制） */}
              <TaskErrorPanel 
                errors={selectedTaskItems
                  .filter(item => item.errorMessage)
                  .map(item => ({
                    questionId: item.questionId,
                    error: item.errorMessage || ""
                  }))}
              />

              {/* 子任务列表 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">子任务列表</h3>
                  <div className="flex items-center gap-2">
                    <select
                      onChange={(e) => {
                        const status = e.target.value;
                        if (status) {
                          loadTaskItems(selectedTask.taskId);
                        }
                      }}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value="">全部状态</option>
                      <option value="pending">待处理</option>
                      <option value="processing">处理中</option>
                      <option value="succeeded">成功</option>
                      <option value="failed">失败</option>
                      <option value="skipped">跳过</option>
                    </select>
                    <select
                      onChange={(e) => {
                        const operation = e.target.value;
                        if (operation) {
                          loadTaskItems(selectedTask.taskId);
                        }
                      }}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value="">全部操作</option>
                      <option value="translate">翻译</option>
                      <option value="polish">润色</option>
                      <option value="fill_missing">填漏</option>
                      <option value="category_tags">分类标签</option>
                    </select>
                  </div>
                </div>

                {loadingTaskItems ? (
                  <div className="text-center py-8 text-gray-500">加载中...</div>
                ) : selectedTaskItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">暂无子任务</div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 w-12"></th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">题目ID</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">操作</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">目标语言</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">状态</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">错误信息</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">开始时间</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">完成时间</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedTaskItems.map((item) => {
                          const isExpanded = expandedItemIds.has(item.id);
                          const hasDetails = !!(item.requestBody || item.responseBody);
                          
                          return (
                            <React.Fragment key={item.id}>
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm">
                                  {/* 📊 新增：检查是否有调试数据或错误详情 */}
                                  {(() => {
                                    const hasDebugData = !!(item.aiRequest || item.aiResponse || item.processedData);
                                    const hasLegacyDetails = !!(item.requestBody || item.responseBody);
                                    const hasErrorDetail = !!(item.errorDetail); // ✅ A-4: 检查是否有错误详情
                                    const hasAnyDetails = hasDebugData || hasLegacyDetails || hasErrorDetail;
                                    return hasAnyDetails && (
                                      <button
                                        onClick={() => {
                                          setExpandedItemIds(prev => {
                                            const newSet = new Set(prev);
                                            if (newSet.has(item.id)) {
                                              newSet.delete(item.id);
                                            } else {
                                              newSet.add(item.id);
                                            }
                                            return newSet;
                                          });
                                        }}
                                        className="text-gray-500 hover:text-gray-700"
                                        title={isExpanded ? "收起详情" : "展开详情"}
                                      >
                                        {isExpanded ? "▼" : "▶"}
                                      </button>
                                    );
                                  })()}
                                </td>
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
                                <td className="px-4 py-3 text-sm">
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                    {item.operation === "translate" ? "翻译" : item.operation === "polish" ? "润色" : item.operation === "fill_missing" ? "填漏" : item.operation === "category_tags" ? "分类标签" : item.operation}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {item.targetLang || "-"}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    item.status === "succeeded" ? "bg-green-100 text-green-800" :
                                    item.status === "failed" ? "bg-red-100 text-red-800" :
                                    item.status === "processing" ? "bg-blue-100 text-blue-800" :
                                    item.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                                    "bg-gray-100 text-gray-800"
                                  }`}>
                                    {item.status === "succeeded" ? "成功" :
                                     item.status === "failed" ? "失败" :
                                     item.status === "processing" ? "处理中" :
                                     item.status === "pending" ? "待处理" :
                                     item.status === "skipped" ? "跳过" : item.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {item.errorMessage ? (
                                    <div className="max-w-xs">
                                      <div className="text-red-600 truncate" title={item.errorMessage}>
                                        {item.errorMessage.length > 50 ? `${item.errorMessage.substring(0, 50)}...` : item.errorMessage}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {item.startedAt ? formatDate(item.startedAt) : "-"}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {item.finishedAt ? formatDate(item.finishedAt) : "-"}
                                </td>
                              </tr>
                              {/* ✅ 展开详情行：显示请求体和回复体 */}
                              {isExpanded && (() => {
                                const hasDebugData = !!(item.aiRequest || item.aiResponse || item.processedData);
                                const hasLegacyDetails = !!(item.requestBody || item.responseBody);
                                const hasErrorDetail = !!(item.errorDetail);
                                return hasDebugData || hasLegacyDetails || hasErrorDetail;
                              })() && (
                                <tr>
                                  <td colSpan={8} className="px-4 py-4 bg-gray-50">
                                    <div className="space-y-4">
                                      {/* ✅ A-4: 诊断详情（当 status === failed 或 errorDetail 不为空时显示） */}
                                      {item.errorDetail && (item.status === "failed" || item.errorDetail) && (
                                        <div>
                                          <h4 className="text-sm font-semibold text-red-700 mb-2">🔍 诊断详情</h4>
                                          <div className="bg-white border border-red-200 rounded-lg p-4 space-y-3">
                                            {/* 错误阶段 */}
                                            {item.errorDetail.errorStage && (
                                              <div>
                                                <label className="text-xs font-medium text-gray-600">错误阶段</label>
                                                <div className="mt-1 text-sm text-gray-900 font-mono bg-red-50 border border-red-200 rounded p-2">
                                                  {item.errorDetail.errorStage}
                                                </div>
                                              </div>
                                            )}
                                            
                                            {/* 错误码 */}
                                            {item.errorDetail.errorCode && (
                                              <div>
                                                <label className="text-xs font-medium text-gray-600">错误码</label>
                                                <div className="mt-1 text-sm text-gray-900 font-mono bg-red-50 border border-red-200 rounded p-2">
                                                  {item.errorDetail.errorCode}
                                                </div>
                                              </div>
                                            )}
                                            
                                            {/* 错误信息 */}
                                            {item.errorDetail.errorMessage && (
                                              <div>
                                                <label className="text-xs font-medium text-gray-600">错误信息</label>
                                                <div className="mt-1 text-sm text-red-800 bg-red-50 border border-red-200 rounded p-2 whitespace-pre-wrap">
                                                  {item.errorDetail.errorMessage}
                                                </div>
                                              </div>
                                            )}
                                            
                                            {/* 语言信息 */}
                                            <div className="grid grid-cols-3 gap-3">
                                              {item.errorDetail.sourceLanguage && (
                                                <div>
                                                  <label className="text-xs font-medium text-gray-600">源语言</label>
                                                  <div className="mt-1 text-sm text-gray-900">{item.errorDetail.sourceLanguage}</div>
                                                </div>
                                              )}
                                              {item.errorDetail.targetLanguage && (
                                                <div>
                                                  <label className="text-xs font-medium text-gray-600">目标语言</label>
                                                  <div className="mt-1 text-sm text-gray-900">{item.errorDetail.targetLanguage}</div>
                                                </div>
                                              )}
                                              {item.errorDetail.detectedLanguage && (
                                                <div>
                                                  <label className="text-xs font-medium text-gray-600">检测结果</label>
                                                  <div className="mt-1 text-sm text-gray-900">{item.errorDetail.detectedLanguage}</div>
                                                </div>
                                              )}
                                            </div>
                                            
                                            {/* parsedSourceLanguage */}
                                            {item.errorDetail.parsedSourceLanguage && (
                                              <div>
                                                <label className="text-xs font-medium text-gray-600">parsed.source.language</label>
                                                <div className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 border border-gray-200 rounded p-2">
                                                  {item.errorDetail.parsedSourceLanguage}
                                                </div>
                                              </div>
                                            )}
                                            
                                            {/* translationsKeys */}
                                            {item.errorDetail.translationsKeys && Array.isArray(item.errorDetail.translationsKeys) && (
                                              <div>
                                                <label className="text-xs font-medium text-gray-600">translations 中的所有语言 key</label>
                                                <div className="mt-1 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded p-2">
                                                  {item.errorDetail.translationsKeys.join(", ")}
                                                </div>
                                              </div>
                                            )}
                                            
                                            {/* sampleText */}
                                            {item.errorDetail.sampleText && (
                                              <div>
                                                <label className="text-xs font-medium text-gray-600">示例文本</label>
                                                <div className="mt-1 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded p-2 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                                  {item.errorDetail.sampleText}
                                                </div>
                                              </div>
                                            )}
                                            
                                            {/* 可折叠 JSON 区块 */}
                                            <details className="mt-3">
                                              <summary className="text-xs font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                                                展开完整诊断数据（JSON）
                                              </summary>
                                              <div className="mt-2 space-y-2">
                                                {/* parsed */}
                                                {item.errorDetail.parsed && (
                                                  <div>
                                                    <label className="text-xs font-medium text-gray-600">parsed（原始 AI 响应）</label>
                                                    <pre className="text-xs text-gray-900 bg-gray-50 border border-gray-200 rounded p-3 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                                                      {JSON.stringify(item.errorDetail.parsed, null, 2)}
                                                    </pre>
                                                  </div>
                                                )}
                                                
                                                {/* sanitized */}
                                                {item.errorDetail.sanitized && (
                                                  <div>
                                                    <label className="text-xs font-medium text-gray-600">sanitized（清洗后的 JSON）</label>
                                                    <pre className="text-xs text-gray-900 bg-gray-50 border border-gray-200 rounded p-3 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                                                      {JSON.stringify(item.errorDetail.sanitized, null, 2)}
                                                    </pre>
                                                  </div>
                                                )}
                                                
                                                {/* rawAiResponse */}
                                                {item.errorDetail.rawAiResponse && (
                                                  <div>
                                                    <label className="text-xs font-medium text-gray-600">rawAiResponse（原始 AI 响应字符串）</label>
                                                    <pre className="text-xs text-gray-900 bg-gray-50 border border-gray-200 rounded p-3 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                                                      {item.errorDetail.rawAiResponse}
                                                    </pre>
                                                  </div>
                                                )}
                                                
                                                {/* errorStack */}
                                                {item.errorDetail.errorStack && (
                                                  <div>
                                                    <label className="text-xs font-medium text-gray-600">errorStack（错误堆栈）</label>
                                                    <pre className="text-xs text-red-800 bg-red-50 border border-red-200 rounded p-3 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                                                      {item.errorDetail.errorStack}
                                                    </pre>
                                                  </div>
                                                )}
                                              </div>
                                            </details>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* 📊 新格式：AI 请求体 */}
                                      {item.aiRequest && (
                                        <div>
                                          <h4 className="text-sm font-semibold text-gray-700 mb-2">📤 AI 请求体（完整）</h4>
                                          <div className="bg-white border rounded-lg p-4">
                                            <pre className="text-xs text-gray-900 bg-blue-50 border border-blue-200 rounded p-3 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                                              {JSON.stringify(item.aiRequest, null, 2)}
                                            </pre>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* 📊 新格式：AI 响应 */}
                                      {item.aiResponse && (
                                        <div>
                                          <h4 className="text-sm font-semibold text-gray-700 mb-2">📥 AI 响应（完整）</h4>
                                          <div className="bg-white border rounded-lg p-4">
                                            <pre className="text-xs text-gray-900 bg-green-50 border border-green-200 rounded p-3 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                                              {JSON.stringify(item.aiResponse, null, 2)}
                                            </pre>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* 📊 新格式：最终入库数据 */}
                                      {item.processedData && (
                                        <div>
                                          <h4 className="text-sm font-semibold text-gray-700 mb-2">💾 最终入库数据</h4>
                                          <div className="bg-white border rounded-lg p-4">
                                            <pre className="text-xs text-gray-900 bg-purple-50 border border-purple-200 rounded p-3 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                                              {JSON.stringify(item.processedData, null, 2)}
                                            </pre>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* 兼容旧格式：请求体详情 */}
                                      {!item.aiRequest && item.requestBody && (
                                        <div>
                                          <h4 className="text-sm font-semibold text-gray-700 mb-2">📤 请求体（旧格式）</h4>
                                          <div className="bg-white border rounded-lg p-4 space-y-3">
                                            {item.requestBody.sceneName && (
                                              <div>
                                                <label className="text-xs font-medium text-gray-600">场景名称</label>
                                                <div className="mt-1 text-sm text-gray-900">{item.requestBody.sceneName}</div>
                                              </div>
                                            )}
                                            {item.requestBody.prompt && (
                                              <div>
                                                <label className="text-xs font-medium text-gray-600">Prompt</label>
                                                <div className="mt-1 text-sm text-gray-900 bg-yellow-50 border border-yellow-200 rounded p-2 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                                                  {item.requestBody.prompt}
                                                </div>
                                              </div>
                                            )}
                                            {item.requestBody.question && (
                                              <div>
                                                <label className="text-xs font-medium text-gray-600">发送给AI的问题</label>
                                                <div className="mt-1 text-sm text-gray-900 bg-blue-50 border border-blue-200 rounded p-2 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                                                  {item.requestBody.question}
                                                </div>
                                              </div>
                                            )}
                                            {item.requestBody.expectedFormat && (
                                              <div>
                                                <label className="text-xs font-medium text-gray-600">预期输出格式</label>
                                                <div className="mt-1 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded p-2 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                                                  {item.requestBody.expectedFormat}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* 兼容旧格式：回复体详情 */}
                                      {!item.aiResponse && item.responseBody && (
                                        <div>
                                          <h4 className="text-sm font-semibold text-gray-700 mb-2">📥 AI 回复体（旧格式）</h4>
                                          <div className="bg-white border rounded-lg p-4 space-y-3">
                                            {item.responseBody.aiProvider && (
                                              <div>
                                                <label className="text-xs font-medium text-gray-600">AI 服务提供商</label>
                                                <div className="mt-1 text-sm text-gray-900">{item.responseBody.aiProvider}</div>
                                              </div>
                                            )}
                                            {item.responseBody.model && (
                                              <div>
                                                <label className="text-xs font-medium text-gray-600">AI 模型</label>
                                                <div className="mt-1 text-sm text-gray-900">{item.responseBody.model}</div>
                                              </div>
                                            )}
                                            {item.responseBody.answer && (
                                              <div>
                                                <label className="text-xs font-medium text-gray-600">AI 回答</label>
                                                <div className="mt-1 text-sm text-gray-900 bg-green-50 border border-green-200 rounded p-2 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                                                  {item.responseBody.answer}
                                                </div>
                                              </div>
                                            )}
                                            {item.responseBody.error && (
                                              <div>
                                                <label className="text-xs font-medium text-gray-600">错误信息</label>
                                                <div className="mt-1 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                                                  {item.responseBody.error}
                                                </div>
                                              </div>
                                            )}
                                            {item.responseBody.timestamp && (
                                              <div>
                                                <label className="text-xs font-medium text-gray-600">时间戳</label>
                                                <div className="mt-1 text-sm text-gray-900">{formatDate(item.responseBody.timestamp)}</div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
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

