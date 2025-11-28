"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ApiError, apiFetch, apiPost, apiPut, apiDelete } from "@/lib/apiClient";

type QuestionType = "single" | "multiple" | "truefalse";

type Question = {
  id: number;
  type: QuestionType;
  content: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined }; // 支持单语言字符串或多语言对象
  options?: string[];
  correctAnswer: string | string[];
  image?: string;
  explanation?: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined }; // 支持单语言字符串或多语言对象
  category?: string;
  hash?: string;
  aiAnswer?: string;
  license_tags?: string[]; // 驾照类型标签
  stage_tag?: "both" | "provisional" | "regular"; // 阶段标签
  topic_tags?: string[]; // 主题标签数组
  created_at?: string; // 创建时间
  updated_at?: string; // 更新时间
};

type ListResponse = {
  items: Question[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages?: number; // 兼容旧字段
    totalPages?: number; // 实际API返回的字段
    hasPrev?: boolean;
    hasNext?: boolean;
  };
};

type Filters = {
  page: number;
  limit: number;
  category: string;
  search: string;
  source: string; // 题目源：database（数据库）或版本号（历史JSON包）
  sortBy: "id" | "content" | "category" | "type" | "created_at" | "updated_at";
  sortOrder: "asc" | "desc";
  locale?: string;
};

const DEFAULT_FILTERS: Filters = {
  page: 1,
  limit: 20,
  category: "",
  search: "",
  source: "database", // 默认显示数据库题目
  sortBy: "id",
  sortOrder: "asc",
  locale: "zh",
};

export default function QuestionsPage() {
  const router = useRouter();
  const search = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => {
    const q = (k: string, d = "") => (search?.get(k) ?? d);
    const n = (k: string, d: number) => {
      const v = Number(search?.get(k));
      return Number.isFinite(v) && v > 0 ? v : d;
    };
    return {
      page: n("page", DEFAULT_FILTERS.page),
      limit: n("limit", DEFAULT_FILTERS.limit),
      category: q("category", DEFAULT_FILTERS.category),
      search: q("search", DEFAULT_FILTERS.search),
      source: q("source", DEFAULT_FILTERS.source),
      sortBy: (q("sortBy", DEFAULT_FILTERS.sortBy) as Filters["sortBy"]) || "id",
      sortOrder: (q("sortOrder", DEFAULT_FILTERS.sortOrder) as Filters["sortOrder"]) || "asc",
      locale: q("locale", DEFAULT_FILTERS.locale || "zh"),
    };
  });

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [items, setItems] = useState<Question[]>([]);
  const [pagination, setPagination] = useState<ListResponse["pagination"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [updatingHashes, setUpdatingHashes] = useState(false);
  const [updatingPackage, setUpdatingPackage] = useState(false);
  const [importingFromJson, setImportingFromJson] = useState(false);
  const [showImportFromJsonModal, setShowImportFromJsonModal] = useState(false);
  const [superAdminPassword, setSuperAdminPassword] = useState("");
  const [importSource, setImportSource] = useState<"filesystem" | "database">("filesystem");
  const [importVersion, setImportVersion] = useState<string>("");
  const [importProgress, setImportProgress] = useState<{
    processed: number;
    total: number;
    imported: number;
    updated: number;
    errors: number;
    currentBatch?: number;
    totalBatches?: number;
  } | null>(null);
  const [importFromJsonResult, setImportFromJsonResult] = useState<{
    totalProcessed: number;
    totalImported: number;
    totalUpdated: number;
    totalErrors: number;
    errors: string[];
    results: Array<{
      packageName: string;
      processed: number;
      imported: number;
      updated: number;
      errors: number;
    }>;
  } | null>(null);
  const [versions, setVersions] = useState<Array<{
    version: string;
    totalQuestions: number;
    aiAnswersCount: number;
    createdAt: string;
  }>>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [deletingVersion, setDeletingVersion] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{
    version: string;
    totalQuestions: number;
  } | null>(null);
  const [updateResult, setUpdateResult] = useState<{
    type: "hashes" | "package";
    message: string;
    data?: any;
  } | null>(null);
  const [languageOptions] = useState<string[]>(["zh", "en", "ja"]);
  const [filesystemFiles, setFilesystemFiles] = useState<Array<{
    filename: string;
    category: string;
    questionCount: number;
    modifiedAt: string;
    size: number;
  }>>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // 加载卷类列表（按类别分组）
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await apiFetch<string[]>("/api/admin/questions/categories", {
          method: "GET",
        });
        const data = response.data;
        if (!mounted) return;
        setCategories(data || []);
      } catch (e) {
        if (!mounted) return;
        console.error("Failed to load categories:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 加载文件系统文件列表
  const loadFilesystemFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const response = await apiFetch<Array<{
        filename: string;
        category: string;
        questionCount: number;
        modifiedAt: string;
        size: number;
      }>>("/api/admin/questions/filesystem", {
        method: "GET",
      });
      setFilesystemFiles(response.data || []);
    } catch (e) {
      console.error("Failed to load filesystem files:", e);
      setFilesystemFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  // 初始加载文件系统文件列表
  useEffect(() => {
    loadFilesystemFiles();
  }, [loadFilesystemFiles]);

  // 加载统一版本号列表（历史版本）
  const loadVersions = useCallback(async (setDefaultSource: boolean = false) => {
    setLoadingVersions(true);
    try {
      const response = await apiFetch<Array<{
        version: string;
        totalQuestions: number;
        aiAnswersCount: number;
        createdAt: string;
      }>>("/api/admin/questions/versions", {
        method: "GET",
      });
      const versionsList = response.data || [];
      setVersions(versionsList);
      
      // 如果需要设置默认源，且有版本号列表且当前source是"database"（默认值），则设置为最新的版本号
      if (setDefaultSource && versionsList.length > 0) {
        const currentSource = search?.get("source") || DEFAULT_FILTERS.source;
        if (currentSource === "database") {
          const latestVersion = versionsList[0].version; // 版本号列表已按created_at降序排列，第一个是最新的
          setFilters((prev) => ({
            ...prev,
            source: latestVersion,
          }));
        }
      }
    } catch (e) {
      console.error("Failed to load versions:", e);
    } finally {
      setLoadingVersions(false);
    }
  }, [search]);

  // 初始加载版本号并设置默认源
  useEffect(() => {
    loadVersions(true); // 首次加载时设置默认源
  }, []); // 只在组件挂载时执行一次

  // 删除JSON包版本号
  const handleDeleteVersion = async (version: string) => {
    setDeletingVersion(version);
    try {
      const response = await apiDelete<{ message: string; version: string }>(
        `/api/admin/questions/versions?version=${encodeURIComponent(version)}`
      );

      // 如果删除的是当前选中的版本，切换到数据库
      if (filters.source === version) {
        setFilters((prev) => ({
          ...prev,
          source: "database",
        }));
      }

      // 立即从版本列表中移除已删除的版本（优化用户体验）
      setVersions((prev) => prev.filter((v) => v.version !== version));

      // 重新加载版本号列表（确保与服务器同步）
      await loadVersions(false);

      // 显示成功消息
      setUpdateResult({
        type: "package",
        message: response.message || `版本号 ${version} 已成功删除`,
        data: response,
      });
    } catch (e) {
      console.error("Failed to delete version:", e);
      setFormError(e instanceof Error ? e.message : "删除版本号失败");
      // 删除失败时，重新加载版本列表以恢复状态
      await loadVersions(false);
    } finally {
      setDeletingVersion(null);
      setShowDeleteConfirm(null);
    }
  };

  // 同步 filters 到 URL
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v === "" || v === undefined || v === null) return;
      params.set(k, String(v));
    });
    const qs = params.toString();
    const href = qs ? `/admin/questions?${qs}` : `/admin/questions`;
    window.history.replaceState(null, "", href);
  }, [filters]);

  // 处理排序
  const handleSort = useCallback((field: Filters["sortBy"]) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === "asc" ? "desc" : "asc",
      page: 1, // 排序时重置到第一页
    }));
  }, []);

  // 加载数据函数
  const loadData = useCallback(async (page: number, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      const params: Record<string, any> = {
        page,
        limit: filters.limit,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      };
      if (filters.category) params.category = filters.category;
      if (filters.search) params.search = filters.search;
      if (filters.source) params.source = filters.source;
      if (filters.locale) params.locale = filters.locale;

      // 构建查询字符串
      const queryString = new URLSearchParams(
        Object.entries(params).reduce((acc, [k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            acc[k] = String(v);
          }
          return acc;
        }, {} as Record<string, string>)
      ).toString();

      const fullUrl = queryString ? `/api/admin/questions?${queryString}` : "/api/admin/questions";
      
      // 使用 apiFetch 获取完整响应（包括 pagination）
      const fullResponse = await apiFetch<ListResponse>(fullUrl, {
        method: "GET",
      });

      const payload = fullResponse.data as unknown as any;
      const newItems = (payload.items ?? payload) as Question[];
      const newPagination = fullResponse.pagination || null;

      if (append) {
        // 追加模式：添加到现有列表（去重，避免重复的 ID）
        setItems((prev) => {
          const existingIds = new Set(prev.map((item) => item.id));
          const uniqueNewItems = newItems.filter((item) => !existingIds.has(item.id));
          return [...prev, ...uniqueNewItems];
        });
      } else {
        // 重置模式：替换列表
        setItems(newItems);
      }

      setPagination(newPagination);
      
      // 检查是否还有更多数据
      if (newPagination) {
        // 优先使用 API 返回的 hasNext 字段（最准确）
        // 如果没有 hasNext，则使用 totalPages 计算
        const pag = newPagination as ListResponse["pagination"];
        if (pag && pag.hasNext !== undefined) {
          setHasMore(pag.hasNext);
        } else if (pag) {
          const totalPages = pag.totalPages || pag.pages || 0;
          const currentPage = pag.page || page;
          const hasMoreData = currentPage < totalPages;
          setHasMore(hasMoreData);
        } else {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) {
          setError("未授权：请先登录管理口令");
        } else {
          setError(`${e.errorCode}: ${e.message}`);
        }
      } else {
        setError(e instanceof Error ? e.message : "未知错误");
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters.category, filters.search, filters.source, filters.limit, filters.sortBy, filters.sortOrder, filters.locale]);

  // 初始加载或筛选条件改变时重置
  useEffect(() => {
    setItems([]);
    setHasMore(true);
    loadData(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category, filters.search, filters.source, filters.sortBy, filters.sortOrder, filters.locale]);

  // 无限滚动：加载更多
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !pagination) {
      return;
    }
    
    const pag: ListResponse["pagination"] = pagination as ListResponse["pagination"];
    if (!pag) return;
    
    const nextPage = pag.page + 1;
    // 使用 API 返回的 totalPages 字段（兼容 pages 字段）
    const totalPages = pag.totalPages || pag.pages || 0;
    
    // 如果使用 hasNext，则根据 hasNext 判断
    if (pag.hasNext !== undefined) {
      if (!pag.hasNext) {
        setHasMore(false);
        return;
      }
    } else {
      // 否则使用 totalPages 计算
      if (nextPage > totalPages) {
        setHasMore(false);
        return;
      }
    }
    
    loadData(nextPage, true);
  }, [loadingMore, hasMore, pagination, loadData]);

  // Intersection Observer：检测滚动到底部
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: "200px", // 提前200px开始加载，给更好的用户体验
        threshold: 0.1,
      }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, loadingMore, loading, loadMore]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 搜索时重置到第一页并清空列表
    setItems([]);
    setHasMore(true);
    // 触发重新加载（通过filters变化触发useEffect）
  };

  const onReset = () => {
    setFilters({ ...DEFAULT_FILTERS });
    loadVersions(); // 重置时重新加载版本号列表
  };

  // 移除分页功能，改用无限滚动

  const handleDelete = async (id: number) => {
    if (!confirm(`确认删除题目 #${id}？`)) return;
    try {
      await apiDelete<{ deleted: number }>(`/api/admin/questions/${id}`);
      // 删除后重新加载第一页
      setItems([]);
      setHasMore(true);
      loadData(1, false);
    } catch (e) {
      if (e instanceof ApiError) {
        alert(`删除失败：${e.errorCode} - ${e.message}`);
      } else {
        alert("删除失败：未知错误");
      }
    }
  };

  const handleEdit = (question: Question) => {
    setEditingQuestion(question);
    setShowEditForm(true);
    setShowCreateForm(false);
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);

    const formData = new FormData(e.currentTarget);
    const type = formData.get("type")?.toString() as QuestionType;
    const content = formData.get("content")?.toString() || "";
    const category = formData.get("category")?.toString() || "免许-1";
    const image = formData.get("image")?.toString() || "";
    const explanation = formData.get("explanation")?.toString() || "";

    // 解析选项
    const options: string[] = [];
    if (type === "single" || type === "multiple") {
      const optA = formData.get("optionA")?.toString() || "";
      const optB = formData.get("optionB")?.toString() || "";
      const optC = formData.get("optionC")?.toString() || "";
      const optD = formData.get("optionD")?.toString() || "";
      if (optA) options.push(optA);
      if (optB) options.push(optB);
      if (optC) options.push(optC);
      if (optD) options.push(optD);
    }

    // 解析正确答案
    let correctAnswer: string | string[];
    if (type === "truefalse") {
      correctAnswer = formData.get("correctAnswer")?.toString() === "true" ? "true" : "false";
    } else if (type === "single") {
      correctAnswer = formData.get("correctAnswer")?.toString()?.toUpperCase() || "A";
    } else {
      const answers = formData.getAll("correctAnswer") as string[];
      correctAnswer = answers.map((a) => a.toUpperCase());
    }

    try {
      await apiPost<Question>("/api/admin/questions", {
        type,
        content,
        options: options.length > 0 ? options : undefined,
        correctAnswer,
        image: image || undefined,
        explanation: explanation || undefined,
        category,
      });

      setShowCreateForm(false);
      // 创建后重新加载第一页
      setItems([]);
      setHasMore(true);
      loadData(1, false);
    } catch (e) {
      if (e instanceof ApiError) {
        setFormError(`${e.errorCode}: ${e.message}`);
      } else {
        setFormError(e instanceof Error ? e.message : "创建失败");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingQuestion) return;

    setUpdating(true);
    setFormError(null);

    const formData = new FormData(e.currentTarget);
    const type = formData.get("type")?.toString() as QuestionType;
    const content = formData.get("content")?.toString() || "";
    const category = formData.get("category")?.toString() || editingQuestion.category || "免许-1";
    const image = formData.get("image")?.toString() || "";
    const explanation = formData.get("explanation")?.toString() || "";
    const aiAnswer = formData.get("aiAnswer")?.toString() || "";

    // 解析选项
    const options: string[] = [];
    if (type === "single" || type === "multiple") {
      const optA = formData.get("optionA")?.toString() || "";
      const optB = formData.get("optionB")?.toString() || "";
      const optC = formData.get("optionC")?.toString() || "";
      const optD = formData.get("optionD")?.toString() || "";
      if (optA) options.push(optA);
      if (optB) options.push(optB);
      if (optC) options.push(optC);
      if (optD) options.push(optD);
    }

    // 解析正确答案
    let correctAnswer: string | string[];
    if (type === "truefalse") {
      correctAnswer = formData.get("correctAnswer")?.toString() === "true" ? "true" : "false";
    } else if (type === "single") {
      correctAnswer = formData.get("correctAnswer")?.toString()?.toUpperCase() || "A";
    } else {
      const answers = formData.getAll("correctAnswer") as string[];
      correctAnswer = answers.map((a) => a.toUpperCase());
    }

    try {
      await apiPut<Question>(`/api/admin/questions/${editingQuestion.id}`, {
        type,
        content,
        options: options.length > 0 ? options : undefined,
        correctAnswer,
        image: image || undefined,
        explanation: explanation || undefined,
        category,
        aiAnswer: aiAnswer || undefined,
      });

      setShowEditForm(false);
      setEditingQuestion(null);
      // 更新后重新加载第一页
      setItems([]);
      setHasMore(true);
      loadData(1, false);
    } catch (e) {
      if (e instanceof ApiError) {
        setFormError(`${e.errorCode}: ${e.message}`);
      } else {
        setFormError(e instanceof Error ? e.message : "更新失败");
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const token = localStorage.getItem("ADMIN_TOKEN");
      if (!token) {
        alert("请先登录");
        return;
      }

      const response = await fetch("/api/admin/questions/template", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });

      if (!response.ok) {
        // 尝试解析错误响应
        let errorMessage = "下载失败";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.errorCode || errorMessage;
        } catch {
          // 如果不是 JSON，使用状态文本
          errorMessage = `下载失败: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // 检查响应类型
      const contentType = response.headers.get("content-type");
      
      // 如果是 JSON 错误响应，先解析
      if (contentType && contentType.includes("application/json")) {
        // 这是错误响应（JSON）
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.errorCode || "服务器返回了错误");
      }

      // 验证响应类型是 Excel 文件
      if (!contentType || !contentType.includes("spreadsheetml")) {
        // 尝试读取错误响应
        try {
          const text = await response.text();
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || errorData.errorCode || "服务器返回了错误响应");
        } catch {
          throw new Error("服务器返回的不是 Excel 文件");
        }
      }

      // 获取二进制数据
      const blob = await response.blob();
      
      // 检查 blob 大小，如果太小可能是错误响应
      if (blob.size < 100) {
        // 尝试作为文本读取，可能是错误信息
        const text = await blob.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || errorData.errorCode || "服务器返回了错误");
        } catch {
          throw new Error("下载的文件格式不正确或文件为空");
        }
      }

      // 创建下载链接 - 使用安全的文件名
      const dateStr = new Date().toISOString().split("T")[0];
      const downloadFilename = `题目导入模板_${dateStr}.xlsx`;
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFilename; // 浏览器会自动处理中文文件名编码
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      
      // 清理
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
      }, 100);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "下载模板失败";
      console.error("[handleDownloadTemplate] Error:", e);
      alert(`下载失败: ${errorMessage}\n\n请检查控制台获取更多信息。`);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      alert("只支持Excel文件 (.xlsx, .xls)");
      return;
    }

    setUploading(true);
    setImportResult(null);
    setFormError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("ADMIN_TOKEN");
      if (!token) {
        throw new Error("请先登录");
      }

      const response = await fetch("/api/admin/questions/import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "导入失败");
      }

      const result = await response.json();
      if (result.ok && result.data) {
        setImportResult(result.data);
        // 导入后重新加载第一页
        setItems([]);
        setHasMore(true);
        loadData(1, false);
        e.target.value = ""; // 清空文件选择
      } else {
        throw new Error(result.message || "导入失败");
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setUploading(false);
    }
  };

  // 批量更新题目 hash
  const handleUpdateHashes = async () => {
    if (!confirm("确认要批量更新所有题目的 Hash 吗？这将重新计算所有题目的 Hash 值。")) {
      return;
    }

    setUpdatingHashes(true);
    setUpdateResult(null);
    setFormError(null);

    try {
      const data = await apiPost<{
        totalProcessed: number;
        totalUpdated: number;
        totalErrors: number;
        totalCategories: number;
        errors: string[];
      }>("/api/admin/questions/update-hashes", {});

      setUpdateResult({
        type: "hashes",
        message: `Hash 更新完成：处理了 ${data.totalProcessed} 个题目，更新了 ${data.totalUpdated} 个 Hash，${data.totalErrors} 个错误`,
        data,
      });
      // 重新加载数据以显示新的 hash
      setItems([]);
      setHasMore(true);
      loadData(1, false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "更新 Hash 失败");
    } finally {
      setUpdatingHashes(false);
    }
  };

  // 手动更新 JSON 包
  const handleUpdatePackage = async () => {
    if (!confirm("确认要更新所有题目 JSON 包吗？这将重新计算所有题目的 Hash 并更新统一版本号。")) {
      return;
    }

    setUpdatingPackage(true);
    setUpdateResult(null);
    setFormError(null);

    try {
      const data = await apiPost<{
        version: string;
        totalQuestions: number;
        aiAnswersCount: number;
        message: string;
      }>("/api/admin/questions/update-package", {});

      setUpdateResult({
        type: "package",
        message: data.message || `JSON 包更新完成：统一版本号 ${data.version}，共 ${data.totalQuestions} 个题目，${data.aiAnswersCount} 个AI回答`,
        data,
      });
      // 重新加载版本号列表
      loadVersions();
      // 重新加载数据以显示新的 hash
      setItems([]);
      setHasMore(true);
      loadData(1, false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "更新 JSON 包失败");
    } finally {
      setUpdatingPackage(false);
    }
  };

  // 下载 JSON 包
  const handleDownloadPackage = async (packageName: string) => {
    try {
      const token = localStorage.getItem("ADMIN_TOKEN");
      if (!token) {
        alert("请先登录");
        return;
      }

      const response = await fetch(`/api/admin/questions/download?packageName=${encodeURIComponent(packageName)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "下载失败");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${packageName}.json`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
      }, 100);
    } catch (e) {
      alert(e instanceof Error ? e.message : "下载失败");
    }
  };

  // JSON包入库
  const handleImportFromJson = async () => {
    if (!superAdminPassword.trim()) {
      alert("请输入超级管理员密码");
      return;
    }

    if (!confirm("确认要将JSON包导入到数据库吗？这将覆盖数据库中已存在的题目。")) {
      return;
    }

    setImportingFromJson(true);
    setImportFromJsonResult(null);
    setImportProgress(null);
    setFormError(null);

    try {
      // 使用流式响应获取实时进度
      const token = typeof window !== "undefined" ? window.localStorage.getItem("ADMIN_TOKEN") : null;
      const response = await fetch("/api/admin/questions/import-from-json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          password: superAdminPassword,
          source: importSource,
          version: importSource === "database" ? importVersion : undefined,
          packageName: importSource === "filesystem" ? undefined : undefined,
          useStreaming: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "请求失败" }));
        throw new ApiError({
          status: response.status,
          errorCode: errorData.errorCode || "UNKNOWN_ERROR",
          message: errorData.message || "JSON包入库失败",
        });
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("无法读取响应流");
      }

      let buffer = "";
      let finalResult: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "progress") {
                setImportProgress({
                  processed: data.processed || 0,
                  total: data.total || 0,
                  imported: data.imported || 0,
                  updated: data.updated || 0,
                  errors: data.errors || 0,
                  currentBatch: data.currentBatch,
                  totalBatches: data.totalBatches,
                });
              } else if (data.type === "complete") {
                finalResult = data;
              } else if (data.type === "error") {
                throw new Error(data.message || "导入过程中发生错误");
              }
            } catch (e) {
              console.error("解析进度数据失败:", e, line);
            }
          }
        }
      }

      if (finalResult) {
        setImportFromJsonResult({
          totalProcessed: finalResult.totalProcessed || 0,
          totalImported: finalResult.totalImported || 0,
          totalUpdated: finalResult.totalUpdated || 0,
          totalErrors: finalResult.totalErrors || 0,
          errors: finalResult.errors || [],
          results: [],
        });
        setShowImportFromJsonModal(false);
        setSuperAdminPassword("");
        setImportProgress(null);
        
        // 重新加载数据
        setItems([]);
        setHasMore(true);
        loadData(1, false);
        loadVersions();
        
        alert(`JSON包入库完成：处理了 ${finalResult.totalProcessed} 个题目，新增 ${finalResult.totalImported} 个，更新 ${finalResult.totalUpdated} 个，${finalResult.totalErrors} 个错误`);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 403) {
          setFormError("超级管理员密码错误");
        } else {
          setFormError(e.message || "JSON包入库失败");
        }
      } else {
        setFormError(e instanceof Error ? e.message : "JSON包入库失败");
      }
    } finally {
      setImportingFromJson(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 顶部操作区 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base sm:text-lg font-semibold">题库管理</h2>
          <Link
            href="/admin/questions/list"
            className="inline-flex items-center rounded-xl bg-indigo-500 text-white text-sm font-medium px-3 py-2 hover:bg-indigo-600 active:bg-indigo-700 touch-manipulation transition-colors shadow-sm"
            title="切换到列表视图"
          >
            列表视图
          </Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="inline-flex items-center rounded-xl bg-green-500 text-white text-sm font-medium px-4 py-2.5 sm:px-3 sm:py-2 hover:bg-green-600 active:bg-green-700 touch-manipulation transition-colors shadow-sm"
            onClick={handleDownloadTemplate}
          >
            下载模板
          </button>
          <label className="inline-flex items-center rounded-xl bg-blue-500 text-white text-sm font-medium px-4 py-2.5 sm:px-3 sm:py-2 hover:bg-blue-600 active:bg-blue-700 touch-manipulation transition-colors shadow-sm cursor-pointer">
            {uploading ? "导入中..." : "批量导入"}
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              className="hidden"
              disabled={uploading}
            />
          </label>
          <button
            className="inline-flex items-center rounded-xl bg-purple-500 text-white text-sm font-medium px-4 py-2.5 sm:px-3 sm:py-2 hover:bg-purple-600 active:bg-purple-700 touch-manipulation transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleUpdateHashes}
            disabled={updatingHashes || updatingPackage}
            title="批量更新所有题目的 Hash（无论有没有都重新计算）"
          >
            {updatingHashes ? "更新中..." : "更新Hash"}
          </button>
          <button
            className="inline-flex items-center rounded-xl bg-orange-500 text-white text-sm font-medium px-4 py-2.5 sm:px-3 sm:py-2 hover:bg-orange-600 active:bg-orange-700 touch-manipulation transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleUpdatePackage}
            disabled={updatingHashes || updatingPackage}
            title="更新所有题目 JSON 包（重新计算 hash 并更新版本号）"
          >
            {updatingPackage ? "更新中..." : "更新JSON包"}
          </button>
          <button
            className="inline-flex items-center rounded-xl bg-red-500 text-white text-sm font-medium px-4 py-2.5 sm:px-3 sm:py-2 hover:bg-red-600 active:bg-red-700 touch-manipulation transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              setShowImportFromJsonModal(true);
              setSuperAdminPassword("");
              setFormError(null);
              setImportFromJsonResult(null);
            }}
            disabled={importingFromJson}
            title="将JSON包导入到数据库（需要超级管理员密码）"
          >
            {importingFromJson ? "导入中..." : "JSON入库"}
          </button>
          <button
            className="inline-flex items-center rounded-xl bg-blue-500 text-white text-sm font-medium px-4 py-2.5 sm:px-3 sm:py-2 hover:bg-blue-600 active:bg-blue-700 touch-manipulation transition-colors shadow-sm"
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              setShowEditForm(false);
              setEditingQuestion(null);
            }}
          >
            + 创建题目
          </button>
          <button
            className="rounded-md border border-gray-300 text-sm px-3 py-2 sm:py-1.5 hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
            onClick={() => {
              setItems([]);
              setHasMore(true);
              loadData(1, false);
              loadVersions();
            }}
          >
            刷新
          </button>
        </div>
      </div>


      {/* 更新结果 */}
      {updateResult && (
        <div className="border border-gray-200 rounded-lg p-4 bg-blue-50">
          <div className="text-sm font-medium mb-2">
            {updateResult.type === "hashes" && "Hash 更新结果"}
            {updateResult.type === "package" && "JSON 包更新结果"}
          </div>
          <div className="text-xs space-y-1">
            <div className="text-green-600">{updateResult.message}</div>
            {updateResult.data?.errors && updateResult.data.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-red-600">查看错误详情</summary>
                <ul className="mt-2 space-y-1 pl-4 list-disc">
                  {updateResult.data.errors.map((err: string, idx: number) => (
                    <li key={idx} className="text-xs">{err}</li>
                  ))}
                </ul>
              </details>
            )}
            {updateResult.data?.results && updateResult.data.results.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-blue-600">查看详细结果</summary>
                <ul className="mt-2 space-y-1 pl-4 list-disc">
                  {updateResult.data.results.map((r: any, idx: number) => (
                    <li key={idx} className="text-xs">
                      {r.category}: {r.success ? `✅ ${r.version || "已更新"} (${r.hashUpdated || 0}个Hash)` : "❌ 失败"}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          <button
            className="mt-2 text-xs text-blue-600 hover:underline"
            onClick={() => setUpdateResult(null)}
          >
            关闭
          </button>
        </div>
      )}

      {/* 导入结果 */}
      {importResult && (
        <div className="border border-gray-200 rounded-lg p-4 bg-blue-50">
          <div className="text-sm font-medium mb-2">导入结果</div>
          <div className="text-xs space-y-1">
            <div className="text-green-600">成功: {importResult.success} 条</div>
            {importResult.failed > 0 && (
              <div className="text-red-600">失败: {importResult.failed} 条</div>
            )}
            {importResult.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-red-600">查看错误详情</summary>
                <ul className="mt-2 space-y-1 pl-4 list-disc">
                  {importResult.errors.map((err, idx) => (
                    <li key={idx} className="text-xs">{err}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          <button
            className="mt-2 text-xs text-blue-600 hover:underline"
            onClick={() => setImportResult(null)}
          >
            关闭
          </button>
        </div>
      )}

      {/* JSON包入库弹窗 */}
      {showImportFromJsonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">JSON包入库</h3>
            <p className="text-sm text-gray-600 mb-4">
              此操作将把当前服务端的题目JSON包写入到数据库。需要超级管理员密码确认。
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  数据源
                </label>
                <select
                  value={importSource}
                  onChange={(e) => {
                    setImportSource(e.target.value as "filesystem" | "database");
                    setImportVersion("");
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={importingFromJson}
                >
                  <option value="filesystem">文件系统</option>
                  <option value="database">数据库版本</option>
                </select>
              </div>
              {importSource === "database" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择版本
                  </label>
                  <select
                    value={importVersion}
                    onChange={(e) => setImportVersion(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={importingFromJson}
                  >
                    <option value="">请选择版本</option>
                    {versions.map((v) => (
                      <option key={v.version} value={v.version}>
                        {v.version} ({v.totalQuestions}题, {new Date(v.createdAt).toLocaleString("zh-CN")})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  超级管理员密码
                </label>
                <input
                  type="password"
                  value={superAdminPassword}
                  onChange={(e) => setSuperAdminPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !importingFromJson) {
                      handleImportFromJson();
                    }
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入超级管理员密码"
                  autoFocus
                  disabled={importingFromJson}
                />
              </div>
              {formError && (
                <div className="text-sm text-red-600">{formError}</div>
              )}
              {importProgress && (
                <div className="space-y-2 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">导入进度</span>
                    <span className="text-blue-600">
                      {importProgress.processed} / {importProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                      style={{
                        width: `${importProgress.total > 0 ? (importProgress.processed / importProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  {importProgress.totalBatches && importProgress.currentBatch && (
                    <div className="text-xs text-gray-600">
                      批次: {importProgress.currentBatch} / {importProgress.totalBatches}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-green-600">
                      新增: {importProgress.imported}
                    </div>
                    <div className="text-orange-600">
                      更新: {importProgress.updated}
                    </div>
                    {importProgress.errors > 0 && (
                      <div className="text-red-600 col-span-2">
                        错误: {importProgress.errors}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {importFromJsonResult && (
                <div className="text-sm space-y-1">
                  <div className="text-green-600">
                    处理了 {importFromJsonResult.totalProcessed} 个题目
                  </div>
                  <div className="text-blue-600">
                    新增: {importFromJsonResult.totalImported} 个
                  </div>
                  <div className="text-orange-600">
                    更新: {importFromJsonResult.totalUpdated} 个
                  </div>
                  {importFromJsonResult.totalErrors > 0 && (
                    <div className="text-red-600">
                      错误: {importFromJsonResult.totalErrors} 个
                    </div>
                  )}
                  {importFromJsonResult.results.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-blue-600">查看详细结果</summary>
                      <ul className="mt-2 space-y-1 pl-4 list-disc">
                        {importFromJsonResult.results.map((r, idx) => (
                          <li key={idx} className="text-xs">
                            {r.packageName}: 处理 {r.processed} 个，新增 {r.imported} 个，更新 {r.updated} 个，错误 {r.errors} 个
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleImportFromJson}
                disabled={importingFromJson || !superAdminPassword.trim() || (importSource === "database" && !importVersion)}
                className="flex-1 inline-flex items-center justify-center rounded-md bg-red-500 text-white text-sm px-4 py-2 hover:bg-red-600 active:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {importingFromJson ? "导入中..." : "确认导入"}
              </button>
              <button
                onClick={() => {
                  setShowImportFromJsonModal(false);
                  setSuperAdminPassword("");
                  setImportSource("filesystem");
                  setImportVersion("");
                  setFormError(null);
                  setImportFromJsonResult(null);
                }}
                disabled={importingFromJson}
                className="flex-1 inline-flex items-center justify-center rounded-md border border-gray-300 text-sm px-4 py-2 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 创建表单 */}
      {showCreateForm && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h3 className="text-sm font-medium mb-3">创建新题目</h3>
          <QuestionForm
            onSubmit={handleCreate}
            onCancel={() => {
              setShowCreateForm(false);
              setFormError(null);
            }}
            submitting={creating}
            error={formError}
            categories={categories}
          />
        </div>
      )}

      {/* 编辑表单 */}
      {showEditForm && editingQuestion && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h3 className="text-sm font-medium mb-3">编辑题目 #{editingQuestion.id}</h3>
          <QuestionForm
            question={editingQuestion}
            onSubmit={handleUpdate}
            onCancel={() => {
              setShowEditForm(false);
              setEditingQuestion(null);
              setFormError(null);
            }}
            submitting={updating}
            error={formError}
            categories={categories}
          />
        </div>
      )}

      {/* 筛选表单 */}
      <form onSubmit={onSearchSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">卷类</label>
          <select
            value={filters.category}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                category: e.target.value,
                page: 1,
              }))
            }
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">全部卷类</option>
            {(() => {
              // 按类别分组卷类
              const grouped: Record<string, string[]> = {};
              categories.forEach((cat) => {
                // 提取类别前缀（如"免许-1" -> "免许"）
                const match = cat.match(/^([^-]+)/);
                const prefix = match ? match[1] : "其他";
                if (!grouped[prefix]) {
                  grouped[prefix] = [];
                }
                grouped[prefix].push(cat);
              });
              
              // 按类别排序
              const sortedGroups = Object.keys(grouped).sort();
              
              return sortedGroups.map((prefix) => (
                <optgroup key={prefix} label={prefix}>
                  {grouped[prefix].sort().map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </optgroup>
              ));
            })()}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">语言</label>
          <select
            value={filters.locale}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                locale: e.target.value,
                page: 1,
              }))
            }
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            {languageOptions.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">题目源</label>
          <div className="space-y-1">
            <select
              value={filters.source}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  source: e.target.value,
                  page: 1,
                }))
              }
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="database">数据库</option>
              <optgroup label="历史版本">
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>
                    {v.version} ({v.totalQuestions}题, {new Date(v.createdAt).toLocaleString("zh-CN")})
                  </option>
                ))}
              </optgroup>
              <optgroup label="文件系统">
                {filesystemFiles.map((file) => (
                  <option key={file.filename} value={`filesystem:${file.filename}`}>
                    {file.category} ({file.questionCount}题, {new Date(file.modifiedAt).toLocaleDateString("zh-CN")})
                  </option>
                ))}
              </optgroup>
            </select>
            {/* 删除按钮列表 */}
            {versions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {versions.map((v) => (
                  <button
                    key={v.version}
                    onClick={() => {
                      setShowDeleteConfirm({
                        version: v.version,
                        totalQuestions: v.totalQuestions,
                      });
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded border border-red-200 hover:border-red-300 transition-colors"
                    title={`删除版本 ${v.version}`}
                    disabled={deletingVersion === v.version}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    <span>{v.version}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">搜索内容</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            placeholder="搜索题目ID、内容、选项、解析..."
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-black"
        >
          搜索
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-gray-300 text-sm px-3 py-1.5 hover:bg-gray-100"
        >
          重置
        </button>
      </form>

      {/* 错误提示 */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">确认删除</h2>
            <p className="text-sm text-gray-700 mb-2">
              确定要删除版本号 <span className="font-medium">{showDeleteConfirm.version}</span> 吗？
            </p>
            <p className="text-sm text-gray-600 mb-4">
              此操作将删除该版本号的所有数据（共 {showDeleteConfirm.totalQuestions} 题），且无法恢复。
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDeleteVersion(showDeleteConfirm.version)}
                disabled={deletingVersion === showDeleteConfirm.version}
                className="flex-1 rounded-md bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingVersion === showDeleteConfirm.version ? "删除中..." : "确认删除"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={deletingVersion === showDeleteConfirm.version}
                className="flex-1 rounded-md border border-gray-300 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 列表 - 桌面端 */}
      {loading ? (
        <div className="text-center py-8 text-gray-500 text-sm">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">暂无数据</div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto relative">
            <table className="w-full border-collapse" style={{ tableLayout: "fixed", width: "100%" }}>
              <colgroup>
                <col style={{ width: "60px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "80px" }} />
                <col style={{ width: "300px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "300px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "150px" }} />
                <col style={{ width: "200px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "120px" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th 
                    className="text-left py-2 px-3 text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    onClick={() => handleSort("id")}
                  >
                    ID {filters.sortBy === "id" && (filters.sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th 
                    className="text-left py-2 px-3 text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    onClick={() => handleSort("category")}
                  >
                    卷类 {filters.sortBy === "category" && (filters.sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th 
                    className="text-left py-2 px-3 text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    onClick={() => handleSort("type")}
                  >
                    类型 {filters.sortBy === "type" && (filters.sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th 
                    className="text-left py-2 px-3 text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    onClick={() => handleSort("content")}
                  >
                    题目内容 {filters.sortBy === "content" && (filters.sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700 whitespace-nowrap">正确答案</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700 whitespace-nowrap">解析</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700 whitespace-nowrap">驾照标签</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700 whitespace-nowrap">阶段标签</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700 whitespace-nowrap">主题标签</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700 whitespace-nowrap">Hash / AI回答</th>
                  <th 
                    className="text-left py-2 px-3 text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    onClick={() => handleSort("created_at")}
                  >
                    创建时间 {filters.sortBy === "created_at" && (filters.sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700 sticky right-0 bg-gray-50 z-10 whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={`${item.hash || item.id}-${item.category || 'unknown'}-${index}`} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-xs">{item.id}</td>
                    <td className="py-2 px-3 text-xs font-medium">{item.category || "—"}</td>
                    <td className="py-2 px-3 text-xs">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {item.type === "single" ? "单选" : item.type === "multiple" ? "多选" : "判断"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-xs overflow-hidden" style={{ wordBreak: "break-word", whiteSpace: "normal" }} title={typeof item.content === 'string' ? item.content : (item.content?.zh || item.content?.en || item.content?.ja || '')}>
                      {typeof item.content === 'string' 
                        ? item.content 
                        : (item.content?.zh || item.content?.en || item.content?.ja || '')}
                    </td>
                    <td className="py-2 px-3 text-xs whitespace-nowrap">
                      {Array.isArray(item.correctAnswer)
                        ? item.correctAnswer.join(", ")
                        : item.correctAnswer}
                    </td>
                    <td className="py-2 px-3 text-xs overflow-hidden" style={{ wordBreak: "break-word", whiteSpace: "normal" }}>
                      {item.explanation ? (
                        <div title={
                          typeof item.explanation === 'string' 
                            ? item.explanation 
                            : (typeof item.explanation === 'object' && item.explanation !== null
                                ? (item.explanation.zh || item.explanation.en || item.explanation.ja || '')
                                : '')
                        }>
                          {typeof item.explanation === 'string' 
                            ? item.explanation 
                            : (typeof item.explanation === 'object' && item.explanation !== null
                                ? (item.explanation.zh || item.explanation.en || item.explanation.ja || '')
                                : '')}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs">
                      {item.license_tags && item.license_tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.license_tags.map((tag, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs">
                      {item.stage_tag ? (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          item.stage_tag === "both" ? "bg-green-100 text-green-700" :
                          item.stage_tag === "provisional" ? "bg-yellow-100 text-yellow-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {item.stage_tag === "both" ? "两阶段" :
                           item.stage_tag === "provisional" ? "仮免" : "本免"}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs">
                      {item.topic_tags && item.topic_tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {item.topic_tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700 truncate max-w-[80px]" title={tag}>
                              {tag}
                            </span>
                          ))}
                          {item.topic_tags.length > 3 && (
                            <span className="text-gray-400 text-[10px]">+{item.topic_tags.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs max-w-xs">
                      <div className="flex flex-col gap-0.5">
                        {item.hash && (
                          <div className="text-gray-600 font-mono text-[10px] truncate" title={item.hash}>
                            <span className="text-gray-500">H:</span> {item.hash.substring(0, 12)}...
                          </div>
                        )}
                        {item.aiAnswer && (
                          <div className="text-gray-700 text-[10px] truncate leading-tight" title={item.aiAnswer}>
                            <span className="text-gray-500">AI:</span> {item.aiAnswer.substring(0, 50)}...
                          </div>
                        )}
                        {!item.hash && !item.aiAnswer && (
                          <span className="text-gray-400 text-[10px]">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-500">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString('zh-CN') : "—"}
                    </td>
                    <td className="py-2 px-3 text-xs sticky right-0 bg-white z-10">
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-blue-600 hover:underline mr-2"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:underline"
                      >
                        删除
                      </button>
                      <span className="mx-1 text-gray-300">|</span>
                      <button
                        onClick={async () => {
                          // 创建多选语言对话框
                          const languages = [
                            { value: "zh", label: "中文 (zh)" },
                            { value: "ja", label: "日文 (ja)" },
                            { value: "en", label: "英文 (en)" },
                          ];
                          
                          // 使用简单的多选对话框
                          const selectedLangs: string[] = [];
                          const dialog = document.createElement("div");
                          dialog.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
                          dialog.innerHTML = `
                            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                              <h3 class="text-lg font-semibold mb-4">选择目标语言（可多选）</h3>
                              <div class="space-y-2 mb-4 max-h-60 overflow-y-auto">
                                ${languages.map(lang => `
                                  <label class="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                                    <input type="checkbox" value="${lang.value}" class="rounded" />
                                    <span>${lang.label}</span>
                                  </label>
                                `).join("")}
                              </div>
                              <div class="flex gap-2 justify-end">
                                <button class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300" id="cancel-btn">取消</button>
                                <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" id="confirm-btn">确定</button>
                              </div>
                            </div>
                          `;
                          document.body.appendChild(dialog);
                          
                          const checkboxes = dialog.querySelectorAll("input[type='checkbox']");
                          const cancelBtn = dialog.querySelector("#cancel-btn");
                          const confirmBtn = dialog.querySelector("#confirm-btn");
                          
                          const cleanup = () => document.body.removeChild(dialog);
                          
                          cancelBtn?.addEventListener("click", cleanup);
                          confirmBtn?.addEventListener("click", () => {
                            checkboxes.forEach((cb: any) => {
                              if (cb.checked) selectedLangs.push(cb.value);
                            });
                            cleanup();
                            
                            if (selectedLangs.length === 0) {
                              alert("请至少选择一个目标语言");
                              return;
                            }
                            
                            // 执行翻译，显示进度
                            (async () => {
                              const progressDialog = document.createElement("div");
                              progressDialog.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
                              progressDialog.innerHTML = `
                                <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                                  <h3 class="text-lg font-semibold mb-4">翻译进行中...</h3>
                                  <div id="progress-content" class="space-y-2">
                                    <p class="text-sm text-gray-600">正在准备翻译...</p>
                                  </div>
                                  <div class="mt-4">
                                    <div class="w-full bg-gray-200 rounded-full h-2">
                                      <div id="progress-bar" class="bg-blue-500 h-2 rounded-full transition-all" style="width: 0%"></div>
                                    </div>
                                  </div>
                                </div>
                              `;
                              document.body.appendChild(progressDialog);
                              
                              const progressContent = progressDialog.querySelector("#progress-content");
                              const progressBar = progressDialog.querySelector("#progress-bar") as HTMLElement;
                              
                              try {
                                // 确保 from 有值，不能为空字符串或 null
                                const from = (filters.locale || "zh").trim() || "zh";
                                const payload: any = {
                                  from: from,
                                  to: selectedLangs.length === 1 ? selectedLangs[0] : selectedLangs,
                                };
                                
                                // 验证 from 是否有效
                                if (!from) {
                                  alert("源语言不能为空");
                                  return;
                                }
                                if (item.hash) payload.contentHash = item.hash;
                                else payload.questionId = item.id;
                                
                                // 更新进度
                                if (progressContent) {
                                  progressContent.innerHTML = `<p class="text-sm text-gray-600">正在翻译到: ${selectedLangs.join(", ")}</p>`;
                                }
                                if (progressBar) {
                                  progressBar.style.width = "30%";
                                }
                                
                                const result = await apiPost<{ results: Array<{ locale: string; success: boolean; error?: string }> }>("/api/admin/question-processing/translate", payload);
                                
                                // 显示结果
                                if (progressContent) {
                                  const successCount = result.results?.filter(r => r.success).length || 0;
                                  const failCount = result.results?.filter(r => !r.success).length || 0;
                                  progressContent.innerHTML = `
                                    <p class="text-sm font-semibold text-green-600">翻译完成！</p>
                                    <p class="text-sm text-gray-600 mt-2">成功: ${successCount} | 失败: ${failCount}</p>
                                    ${result.results?.map(r => `
                                      <p class="text-xs ${r.success ? 'text-green-600' : 'text-red-600'} mt-1">
                                        ${r.locale}: ${r.success ? '✓ 成功' : '✗ ' + (r.error || '失败')}
                                      </p>
                                    `).join("") || ""}
                                  `;
                                }
                                if (progressBar) {
                                  progressBar.style.width = "100%";
                                  progressBar.classList.remove("bg-blue-500");
                                  progressBar.classList.add("bg-green-500");
                                }
                                
                                setTimeout(() => {
                                  document.body.removeChild(progressDialog);
                                  window.location.reload();
                                }, 2000);
                              } catch (e) {
                                if (progressContent) {
                                  progressContent.innerHTML = `<p class="text-sm text-red-600">翻译失败: ${e instanceof Error ? e.message : "未知错误"}</p>`;
                                }
                                if (progressBar) {
                                  progressBar.style.width = "100%";
                                  progressBar.classList.remove("bg-blue-500");
                                  progressBar.classList.add("bg-red-500");
                                }
                                setTimeout(() => {
                                  document.body.removeChild(progressDialog);
                                }, 3000);
                              }
                            })();
                          });
                        }}
                        className="text-indigo-600 hover:underline mr-2"
                        title="翻译并润色到指定语言（可多选）"
                      >
                        翻译到...
                      </button>
                      <button
                        onClick={async () => {
                          const locale = filters.locale || "zh";
                          // 创建进度对话框
                          const progressDialog = document.createElement("div");
                          progressDialog.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
                          progressDialog.innerHTML = `
                            <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                              <div class="flex justify-between items-center mb-4">
                                <h3 class="text-lg font-semibold">润色处理中...</h3>
                                <button id="close-dialog" class="text-gray-400 hover:text-gray-600 transition-colors" style="display: none;">
                                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                  </svg>
                                </button>
                              </div>
                              <div id="progress-content" class="mb-4">
                                <p class="text-sm text-gray-600">正在润色 ${locale.toUpperCase()} 语言的内容...</p>
                              </div>
                              <div class="w-full bg-gray-200 rounded-full h-2 mb-4">
                                <div id="progress-bar" class="bg-blue-500 h-2 rounded-full transition-all duration-300" style="width: 30%"></div>
                              </div>
                            </div>
                          `;
                          document.body.appendChild(progressDialog);
                          const progressContent = progressDialog.querySelector("#progress-content");
                          const progressBar = progressDialog.querySelector("#progress-bar") as HTMLElement;
                          const closeBtn = progressDialog.querySelector("#close-dialog") as HTMLElement;
                          const dialogTitle = progressDialog.querySelector("h3") as HTMLElement;
                          
                          // 关闭对话框的函数
                          const closeDialog = () => {
                            document.body.removeChild(progressDialog);
                            window.location.reload();
                          };
                          
                          closeBtn?.addEventListener("click", closeDialog);
                          
                          try {
                            const payload: any = {
                              locale: locale,
                            };
                            if (item.hash) payload.contentHash = item.hash;
                            else payload.questionId = item.id;
                            
                            if (progressBar) {
                              progressBar.style.width = "60%";
                            }
                            
                            const result = await apiPost<{ content?: string; options?: string[]; explanation?: string }>("/api/admin/question-processing/polish", payload);
                            
                            // 显示结果
                            if (progressContent) {
                              progressContent.innerHTML = `
                                <div class="space-y-3">
                                  <div class="p-3 rounded-lg bg-green-50 border border-green-200">
                                    <p class="text-sm font-semibold text-green-700 mb-2">
                                      ✓ 润色完成！
                                    </p>
                                    <p class="text-sm text-gray-700 mb-2">
                                      <span class="font-medium">润色建议已生成，待审核</span>
                                    </p>
                                  </div>
                                  <div class="space-y-2">
                                    <p class="text-sm font-medium text-gray-700">润色后的内容：</p>
                                    ${result.content ? `
                                      <div class="p-3 rounded bg-emerald-50 border border-emerald-200">
                                        <p class="text-xs font-medium text-gray-700 mb-1">内容：</p>
                                        <div class="bg-white p-2 rounded border border-gray-200">
                                          <p class="text-xs text-gray-800 whitespace-pre-wrap">${result.content}</p>
                                        </div>
                                        ${result.options && result.options.length > 0 ? `
                                          <div class="mt-2">
                                            <p class="text-xs font-medium text-gray-700 mb-1">选项：</p>
                                            <div class="bg-white p-2 rounded border border-gray-200">
                                              <ul class="text-xs text-gray-800 space-y-0.5">
                                                ${result.options.map((opt: string, idx: number) => `<li>${idx + 1}. ${opt}</li>`).join('')}
                                              </ul>
                                            </div>
                                          </div>
                                        ` : ''}
                                        ${result.explanation ? `
                                          <div class="mt-2">
                                            <p class="text-xs font-medium text-gray-700 mb-1">解析：</p>
                                            <div class="bg-white p-2 rounded border border-gray-200">
                                              <p class="text-xs text-gray-800 whitespace-pre-wrap">${result.explanation}</p>
                                            </div>
                                          </div>
                                        ` : ''}
                                      </div>
                                    ` : '<p class="text-sm text-gray-600">润色完成，但未返回内容</p>'}
                                  </div>
                                </div>
                              `;
                            }
                            if (progressBar) {
                              progressBar.style.width = "100%";
                              progressBar.classList.remove("bg-blue-500");
                              progressBar.classList.add("bg-green-500");
                            }
                            if (dialogTitle) {
                              dialogTitle.textContent = "润色完成";
                            }
                            if (closeBtn) {
                              closeBtn.style.display = "block";
                            }
                          } catch (e) {
                            if (progressContent) {
                              progressContent.innerHTML = `
                                <div class="p-3 rounded-lg bg-red-50 border border-red-200">
                                  <p class="text-sm font-semibold text-red-700 mb-2">✗ 润色失败</p>
                                  <p class="text-sm text-red-600">${e instanceof Error ? e.message : "未知错误"}</p>
                                </div>
                              `;
                            }
                            if (progressBar) {
                              progressBar.style.width = "100%";
                              progressBar.classList.remove("bg-blue-500");
                              progressBar.classList.add("bg-red-500");
                            }
                            if (dialogTitle) {
                              dialogTitle.textContent = "润色失败";
                            }
                            if (closeBtn) {
                              closeBtn.style.display = "block";
                            }
                          }
                        }}
                        className="text-emerald-600 hover:underline"
                        title="对当前语言题面进行润色（生成待审核）"
                      >
                        润色
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 移动端卡片 */}
          <div className="md:hidden space-y-3">
            {items.map((item, index) => (
              <div key={`${item.hash || item.id}-${item.category || 'unknown'}-${index}`} className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">ID: {item.id}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {item.type === "single" ? "单选" : item.type === "multiple" ? "多选" : "判断"}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">卷类</div>
                  <div className="text-sm font-medium">{item.category || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">题目内容</div>
                  <div className="text-sm">
                    {typeof item.content === 'string' 
                      ? item.content 
                      : (item.content?.zh || item.content?.en || item.content?.ja || '')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">正确答案</div>
                  <div className="text-xs">
                    {Array.isArray(item.correctAnswer)
                      ? item.correctAnswer.join(", ")
                      : item.correctAnswer}
                  </div>
                </div>
                {item.explanation && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">解析</div>
                    <div className="text-xs text-gray-700">
                      {typeof item.explanation === 'string' 
                        ? item.explanation 
                        : (item.explanation?.zh || item.explanation?.en || item.explanation?.ja || '')}
                    </div>
                  </div>
                )}
                {(item.hash || item.aiAnswer) && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Hash / AI回答</div>
                    <div className="text-xs space-y-1">
                      {item.hash && (
                        <div className="text-gray-600 font-mono truncate" title={item.hash}>
                          Hash: {item.hash.substring(0, 16)}...
                        </div>
                      )}
                      {item.aiAnswer && (
                        <div className="text-gray-700 truncate" title={item.aiAnswer}>
                          AI: {item.aiAnswer.substring(0, 50)}...
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {item.options && item.options.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">选项</div>
                    <div className="text-xs space-y-1">
                      {item.options.map((opt, idx) => (
                        <div key={idx}>{String.fromCharCode(65 + idx)}. {opt}</div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleEdit(item)}
                    className="flex-1 text-center rounded-xl bg-blue-500 text-white px-4 py-2.5 text-sm font-medium hover:bg-blue-600 active:bg-blue-700 touch-manipulation transition-colors shadow-sm"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="flex-1 text-center rounded-xl bg-red-500 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-600 active:bg-red-700 touch-manipulation transition-colors shadow-sm"
                  >
                    删除
                  </button>
                  <button
                    onClick={async () => {
                      // 创建语言选择对话框
                      const dialog = document.createElement("div");
                      dialog.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
                      dialog.innerHTML = `
                        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                          <h3 class="text-lg font-semibold mb-4">选择翻译语言</h3>
                          <div class="space-y-4">
                            <div>
                              <label class="block text-sm font-medium mb-2">源语言</label>
                              <select id="translate-from" class="w-full border rounded px-3 py-2">
                                <option value="zh" ${(filters.locale || "zh") === "zh" ? "selected" : ""}>中文 (zh)</option>
                                <option value="ja" ${(filters.locale || "zh") === "ja" ? "selected" : ""}>日文 (ja)</option>
                                <option value="en" ${(filters.locale || "zh") === "en" ? "selected" : ""}>英文 (en)</option>
                              </select>
                            </div>
                            <div>
                              <label class="block text-sm font-medium mb-2">目标语言</label>
                              <select id="translate-to" class="w-full border rounded px-3 py-2">
                                <option value="zh">中文 (zh)</option>
                                <option value="ja" selected>日文 (ja)</option>
                                <option value="en">英文 (en)</option>
                              </select>
                            </div>
                          </div>
                          <div class="flex gap-3 mt-6">
                            <button id="translate-confirm" class="flex-1 px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600">
                              确认翻译
                            </button>
                            <button id="translate-cancel" class="flex-1 px-4 py-2 border rounded hover:bg-gray-50">
                              取消
                            </button>
                          </div>
                        </div>
                      `;
                      document.body.appendChild(dialog);
                      
                      const confirmBtn = dialog.querySelector("#translate-confirm");
                      const cancelBtn = dialog.querySelector("#translate-cancel");
                      const fromSelect = dialog.querySelector("#translate-from") as HTMLSelectElement;
                      const toSelect = dialog.querySelector("#translate-to") as HTMLSelectElement;
                      
                      const cleanup = () => {
                        document.body.removeChild(dialog);
                      };
                      
                      cancelBtn?.addEventListener("click", cleanup);
                      confirmBtn?.addEventListener("click", async () => {
                        // 确保 from 和 to 都有值，不能为空字符串
                        const from = (fromSelect?.value || filters.locale || "zh").trim() || "zh";
                        const to = (toSelect?.value || "ja").trim() || "ja";
                        
                        // 验证 from 和 to 是否有效
                        if (!from || !to) {
                          alert("源语言和目标语言不能为空");
                          return;
                        }
                        
                        if (from === to) {
                          alert("源语言和目标语言不能相同");
                          return;
                        }
                        
                        cleanup();
                        
                        // 创建进度对话框
                        const progressDialog = document.createElement("div");
                        progressDialog.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
                        progressDialog.innerHTML = `
                          <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                            <div class="flex justify-between items-center mb-4">
                              <h3 class="text-lg font-semibold">翻译处理中...</h3>
                              <button id="close-dialog" class="text-gray-400 hover:text-gray-600 transition-colors" style="display: none;">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                              </button>
                            </div>
                            <div id="progress-content" class="mb-4">
                              <p class="text-sm text-gray-600">正在翻译到: ${to}</p>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-2 mb-4">
                              <div id="progress-bar" class="bg-blue-500 h-2 rounded-full transition-all duration-300" style="width: 30%"></div>
                            </div>
                          </div>
                        `;
                        document.body.appendChild(progressDialog);
                        const progressContent = progressDialog.querySelector("#progress-content");
                        const progressBar = progressDialog.querySelector("#progress-bar") as HTMLElement;
                        const closeBtn = progressDialog.querySelector("#close-dialog") as HTMLElement;
                        const dialogTitle = progressDialog.querySelector("h3") as HTMLElement;
                        
                        // 关闭对话框的函数
                        const closeDialog = () => {
                          document.body.removeChild(progressDialog);
                          window.location.reload();
                        };
                        
                        closeBtn?.addEventListener("click", closeDialog);
                        
                        try {
                          const payload: any = {
                            from: from,
                            to: to,
                          };
                          if (item.hash) payload.contentHash = item.hash;
                          else payload.questionId = item.id;
                          
                          if (progressBar) {
                            progressBar.style.width = "60%";
                          }
                          
                          const result = await apiPost<{ results: Array<{ locale: string; success: boolean; error?: string }> }>("/api/admin/question-processing/translate", payload);
                          
                          // 显示结果
                          let allSuccess = false;
                          if (progressContent) {
                            const successCount = result.results?.filter(r => r.success).length || 0;
                            const failCount = result.results?.filter(r => !r.success).length || 0;
                            allSuccess = failCount === 0;
                            
                            progressContent.innerHTML = `
                              <div class="space-y-3">
                                <div class="p-3 rounded-lg ${allSuccess ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}">
                                  <p class="text-sm font-semibold ${allSuccess ? 'text-green-700' : 'text-yellow-700'} mb-2">
                                    ${allSuccess ? '✓ 翻译完成！' : '⚠ 翻译部分完成'}
                                  </p>
                                  <p class="text-sm text-gray-700 mb-2">
                                    <span class="font-medium">处理结果：</span>成功 ${successCount} 个，失败 ${failCount} 个
                                  </p>
                                </div>
                                <div class="space-y-2">
                                  <p class="text-sm font-medium text-gray-700">详细结果：</p>
                                  ${result.results?.map(r => `
                                    <div class="p-3 rounded ${r.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}">
                                      <p class="text-xs font-medium ${r.success ? 'text-green-700' : 'text-red-700'} mb-2">
                                        ${r.locale.toUpperCase()}: ${r.success ? '✓ 翻译成功' : '✗ 翻译失败'}
                                      </p>
                                      ${r.success && (r as any).content ? `
                                        <div class="mt-2 space-y-1">
                                          <p class="text-xs font-medium text-gray-700">翻译后的内容：</p>
                                          <div class="bg-white p-2 rounded border border-gray-200">
                                            <p class="text-xs text-gray-800 whitespace-pre-wrap">${(r as any).content}</p>
                                          </div>
                                          ${(r as any).options && (r as any).options.length > 0 ? `
                                            <div class="mt-1">
                                              <p class="text-xs font-medium text-gray-700">选项：</p>
                                              <div class="bg-white p-2 rounded border border-gray-200">
                                                <ul class="text-xs text-gray-800 space-y-0.5">
                                                  ${(r as any).options.map((opt: string, idx: number) => `<li>${idx + 1}. ${opt}</li>`).join('')}
                                                </ul>
                                              </div>
                                            </div>
                                          ` : ''}
                                          ${(r as any).explanation ? `
                                            <div class="mt-1">
                                              <p class="text-xs font-medium text-gray-700">解析：</p>
                                              <div class="bg-white p-2 rounded border border-gray-200">
                                                <p class="text-xs text-gray-800 whitespace-pre-wrap">${(r as any).explanation}</p>
                                              </div>
                                            </div>
                                          ` : ''}
                                        </div>
                                      ` : ''}
                                      ${!r.success && r.error ? `
                                        <p class="text-xs text-red-600 mt-1">错误: ${r.error}</p>
                                      ` : ''}
                                    </div>
                                  `).join("") || ""}
                                </div>
                              </div>
                            `;
                          }
                          if (progressBar) {
                            progressBar.style.width = "100%";
                            progressBar.classList.remove("bg-blue-500");
                            progressBar.classList.add(allSuccess ? "bg-green-500" : "bg-yellow-500");
                          }
                          if (dialogTitle) {
                            dialogTitle.textContent = allSuccess ? "翻译完成" : "翻译部分完成";
                          }
                          if (closeBtn) {
                            closeBtn.style.display = "block";
                          }
                        } catch (e) {
                          if (progressContent) {
                            progressContent.innerHTML = `
                              <div class="p-3 rounded-lg bg-red-50 border border-red-200">
                                <p class="text-sm font-semibold text-red-700 mb-2">✗ 翻译失败</p>
                                <p class="text-sm text-red-600">${e instanceof Error ? e.message : "未知错误"}</p>
                              </div>
                            `;
                          }
                          if (progressBar) {
                            progressBar.style.width = "100%";
                            progressBar.classList.remove("bg-blue-500");
                            progressBar.classList.add("bg-red-500");
                          }
                          if (dialogTitle) {
                            dialogTitle.textContent = "翻译失败";
                          }
                          if (closeBtn) {
                            closeBtn.style.display = "block";
                          }
                        }
                      });
                    }}
                    className="flex-1 text-center rounded-xl bg-indigo-500 text-white px-4 py-2.5 text-sm font-medium hover:bg-indigo-600 active:bg-indigo-700 transition-colors shadow-sm"
                  >
                    翻译到...
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const payload: any = {
                          locale: filters.locale || "zh",
                        };
                        if (item.hash) payload.contentHash = item.hash;
                        else payload.questionId = item.id;
                        await apiPost("/api/admin/question-processing/polish", payload);
                        alert("润色建议已生成，待审核");
                      } catch (e) {
                        alert(e instanceof Error ? e.message : "润色提交失败");
                      }
                    }}
                    className="flex-1 text-center rounded-xl bg-emerald-500 text-white px-4 py-2.5 text-sm font-medium hover:bg-emerald-600 active:bg-emerald-700 transition-colors shadow-sm"
                  >
                    润色
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 无限滚动触发器 */}
          <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
            {loadingMore && (
              <div className="text-sm text-gray-500">加载中...</div>
            )}
            {!hasMore && items.length > 0 && (
              <div className="text-sm text-gray-500">没有更多数据了</div>
            )}
            {!loadingMore && hasMore && items.length > 0 && (
              <div className="text-sm text-gray-400">滚动加载更多</div>
            )}
          </div>

          {/* 数据统计 */}
          {pagination && (
            <div className="text-center text-xs text-gray-500 mt-2">
              已加载 {items.length} / {pagination.total} 条
              <span className="ml-2">
                (第 {pagination.page} / {pagination.totalPages || pagination.pages || 0} 页)
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// 题目表单组件
function QuestionForm({
  question,
  onSubmit,
  onCancel,
  submitting,
  error,
  categories,
}: {
  question?: Question;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
  categories: string[];
}) {
  const [type, setType] = useState<QuestionType>(question?.type || "single");
  const [showOptions, setShowOptions] = useState(
    question?.type === "single" || question?.type === "multiple" || !question
  );

  useEffect(() => {
    setShowOptions(type === "single" || type === "multiple");
  }, [type]);

  const correctAnswer = question?.correctAnswer;

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          卷类 * 
          <span className="text-gray-500 font-normal ml-1">(可选择现有卷类或输入新卷类名称)</span>
        </label>
        <input
          type="text"
          name="category"
          required
          list="category-list"
          defaultValue={question?.category || categories[0] || "免许-1"}
          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          placeholder="输入卷类名称，或从下拉列表选择..."
        />
        <datalist id="category-list">
          {categories.map((cat) => (
            <option key={cat} value={cat} />
          ))}
          {categories.length === 0 && (
            <option value="免许-1" />
          )}
        </datalist>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">类型 *</label>
        <select
          name="type"
          required
          value={type}
          onChange={(e) => setType(e.target.value as QuestionType)}
          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="single">单选题</option>
          <option value="multiple">多选题</option>
          <option value="truefalse">判断题</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">题目内容 *</label>
        <textarea
          name="content"
          required
          rows={3}
          defaultValue={typeof question?.content === 'string' 
            ? question.content 
            : (question?.content?.zh || "")}
          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          placeholder="请输入题目内容..."
        />
      </div>

      {showOptions && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">选项A *</label>
            <input
              type="text"
              name="optionA"
              required={showOptions}
              defaultValue={question?.options?.[0] || ""}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">选项B *</label>
            <input
              type="text"
              name="optionB"
              required={showOptions}
              defaultValue={question?.options?.[1] || ""}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">选项C</label>
            <input
              type="text"
              name="optionC"
              defaultValue={question?.options?.[2] || ""}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">选项D</label>
            <input
              type="text"
              name="optionD"
              defaultValue={question?.options?.[3] || ""}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">正确答案 *</label>
        {type === "truefalse" ? (
          <select
            name="correctAnswer"
            required
            defaultValue={
              typeof correctAnswer === "string" ? correctAnswer : "true"
            }
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="true">正确</option>
            <option value="false">错误</option>
          </select>
        ) : type === "single" ? (
          <select
            name="correctAnswer"
            required
            defaultValue={
              typeof correctAnswer === "string" ? correctAnswer.toUpperCase() : "A"
            }
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
        ) : (
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="correctAnswer"
                value="A"
                defaultChecked={
                  Array.isArray(correctAnswer) ? correctAnswer.includes("A") : false
                }
              />
              <span className="text-sm">A</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="correctAnswer"
                value="B"
                defaultChecked={
                  Array.isArray(correctAnswer) ? correctAnswer.includes("B") : false
                }
              />
              <span className="text-sm">B</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="correctAnswer"
                value="C"
                defaultChecked={
                  Array.isArray(correctAnswer) ? correctAnswer.includes("C") : false
                }
              />
              <span className="text-sm">C</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="correctAnswer"
                value="D"
                defaultChecked={
                  Array.isArray(correctAnswer) ? correctAnswer.includes("D") : false
                }
              />
              <span className="text-sm">D</span>
            </label>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">图片URL</label>
        <input
          type="text"
          name="image"
          defaultValue={question?.image || ""}
          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          placeholder="https://..."
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">解析</label>
        <textarea
          name="explanation"
          rows={2}
          defaultValue={
            question?.explanation
              ? typeof question.explanation === 'string'
                ? question.explanation
                : (typeof question.explanation === 'object' && question.explanation !== null
                    ? (question.explanation.zh || question.explanation.en || question.explanation.ja || '')
                    : '')
              : ""
          }
          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          placeholder="请输入题目解析..."
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          AI解析
          <span className="text-gray-500 font-normal ml-1">(AI生成的题目解析)</span>
        </label>
        <textarea
          name="aiAnswer"
          rows={4}
          defaultValue={question?.aiAnswer || ""}
          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          placeholder="请输入或编辑AI解析..."
        />
      </div>

      {error && <div className="text-xs text-red-600">{error}</div>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center rounded-md bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-black disabled:opacity-50"
        >
          {submitting ? "保存中..." : question ? "更新" : "创建"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 text-sm px-3 py-1.5 hover:bg-gray-100"
        >
          取消
        </button>
      </div>
    </form>
  );
}

