"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { apiFetch, apiPost, ApiError } from "@/lib/apiClient";

interface Review {
  id: number;
  content_hash: string;
  locale: string;
  proposed_content: string;
  proposed_options?: string[];
  proposed_explanation?: string;
  status: "pending" | "approved" | "rejected";
  notes?: string;
  created_at: string;
  question_id?: number | null;
  question_category?: string | null;
  original_content?: any;
  original_options?: any;
  original_explanation?: any;
  category?: string | null;
}

interface ReviewsResponse {
  reviews: Review[];
  total: number;
  limit: number;
  offset: number;
}

// 按 content_hash 和 locale 分组的润色记录
interface GroupedReview {
  content_hash: string;
  locale: string;
  question_id: number | null;
  question_category: string | null;
  category: string | null; // 从 review.category 获取的备用分类
  original_content: any;
  original_options: any;
  original_explanation: any;
  reviews: Review[];
  selectedReviewId: number | null;
}

function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("ADMIN_TOKEN");
  } catch {
    return null;
  }
}

export default function PolishReviewsPage() {
  const [groupedReviews, setGroupedReviews] = useState<GroupedReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "">("pending");
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const limit = 20;

  // 加载数据
  const loadData = useCallback(async (append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
        offsetRef.current = 0;
      }

      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", String(limit));
      params.set("offset", String(offsetRef.current));

      const response = await apiFetch<ReviewsResponse>(
        `/api/admin/question-processing/reviews?${params.toString()}`
      );

      if (response.data) {
        const newReviews = response.data.reviews || [];
        setTotal(response.data.total || 0);

        if (append) {
          // 追加模式：合并到现有数据
          const existingHashes = new Set(
            groupedReviews.map(g => `${g.content_hash}-${g.locale}`)
          );
          
          // 按 content_hash 和 locale 分组新数据
          const newGrouped: Record<string, GroupedReview> = {};
          newReviews.forEach((review) => {
            const key = `${review.content_hash}-${review.locale}`;
            if (!existingHashes.has(key)) {
              if (!newGrouped[key]) {
                newGrouped[key] = {
                  content_hash: review.content_hash,
                  locale: review.locale,
                  question_id: review.question_id ?? null,
                  question_category: review.question_category ?? null,
                  category: review.category ?? null,
                  original_content: review.original_content,
                  original_options: review.original_options,
                  original_explanation: review.original_explanation,
                  reviews: [],
                  selectedReviewId: null,
                };
              }
              newGrouped[key].reviews.push(review);
              // 默认选择第一个待审核的版本，如果没有则选择第一个
              if (!newGrouped[key].selectedReviewId) {
                if (review.status === "pending") {
                  newGrouped[key].selectedReviewId = review.id;
                } else if (newGrouped[key].reviews.length === 1) {
                  newGrouped[key].selectedReviewId = review.id;
                }
              }
            }
          });

          setGroupedReviews(prev => [...prev, ...Object.values(newGrouped)]);
        } else {
          // 初始加载：重新分组所有数据
          const grouped: Record<string, GroupedReview> = {};
          newReviews.forEach((review) => {
            const key = `${review.content_hash}-${review.locale}`;
            if (!grouped[key]) {
              grouped[key] = {
                content_hash: review.content_hash,
                locale: review.locale,
                question_id: review.question_id ?? null,
                question_category: review.question_category ?? null,
                category: review.category ?? null,
                original_content: review.original_content,
                original_options: review.original_options,
                original_explanation: review.original_explanation,
                reviews: [],
                selectedReviewId: null,
              };
            }
            grouped[key].reviews.push(review);
            // 默认选择第一个待审核的版本，如果没有则选择第一个
            if (!grouped[key].selectedReviewId) {
              if (review.status === "pending") {
                grouped[key].selectedReviewId = review.id;
              } else if (grouped[key].reviews.length === 1) {
                grouped[key].selectedReviewId = review.id;
              }
            }
          });

          setGroupedReviews(Object.values(grouped));
        }

        offsetRef.current += newReviews.length;
        setHasMore(offsetRef.current < (response.data.total || 0));
      } else {
        setError("加载失败");
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "加载失败");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [statusFilter, groupedReviews]);

  useEffect(() => {
    loadData(false);
  }, [statusFilter]);

  // 无限滚动：加载更多
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) {
      return;
    }
    loadData(true);
  }, [loadingMore, hasMore, loadData]);

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
        rootMargin: "200px",
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

  const approve = async (reviewId: number) => {
    try {
      const token = getAdminToken();
      const res = await fetch(`/api/admin/question-processing/reviews/${reviewId}/approve`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        // 重新加载数据
        offsetRef.current = 0;
        loadData(false);
      }
    } catch (e) {
      console.error("Approve failed:", e);
      alert("审核失败");
    }
  };

  const reject = async (reviewId: number) => {
    const notes = prompt("请输入驳回原因（可选）") || "";
    try {
      const token = getAdminToken();
      const res = await fetch(`/api/admin/question-processing/reviews/${reviewId}/reject`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        // 重新加载数据
        offsetRef.current = 0;
        loadData(false);
      }
    } catch (e) {
      console.error("Reject failed:", e);
      alert("驳回失败");
    }
  };

  // 获取原题干内容
  const getOriginalContent = (group: GroupedReview): string => {
    if (group.original_content) {
      if (typeof group.original_content === "string") {
        return group.original_content;
      } else if (typeof group.original_content === "object") {
        return group.original_content[group.locale] || group.original_content.zh || group.original_content.en || group.original_content.ja || "";
      }
    }
    return "";
  };

  // 获取原选项
  const getOriginalOptions = (group: GroupedReview): string[] | null => {
    if (group.original_options) {
      if (Array.isArray(group.original_options)) {
        return group.original_options;
      }
    }
    return null;
  };

  // 获取原解析
  const getOriginalExplanation = (group: GroupedReview): string => {
    if (group.original_explanation) {
      if (typeof group.original_explanation === "string") {
        return group.original_explanation;
      } else if (typeof group.original_explanation === "object") {
        return group.original_explanation[group.locale] || group.original_explanation.zh || group.original_explanation.en || group.original_explanation.ja || "";
      }
    }
    return "";
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">题目润色审核</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">状态筛选:</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              offsetRef.current = 0;
            }}
          >
            <option value="">全部</option>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
          </select>
          <button
            className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
            onClick={() => {
              offsetRef.current = 0;
              loadData(false);
            }}
            disabled={loading}
          >
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && groupedReviews.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">加载中...</div>
      ) : groupedReviews.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">暂无数据</div>
      ) : (
        <div className="space-y-4">
          {groupedReviews.map((group, groupIdx) => {
            const selectedReview = group.reviews.find(r => r.id === group.selectedReviewId) || group.reviews[0];
            const originalContent = getOriginalContent(group);
            const originalOptions = getOriginalOptions(group);
            const originalExplanation = getOriginalExplanation(group);

            return (
              <div key={`${group.content_hash}-${group.locale}-${groupIdx}`} className="border rounded-lg p-4 bg-white shadow-sm">
                {/* 题目信息行 */}
                <div className="flex items-center justify-between mb-3 pb-3 border-b">
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">题目ID:</span>{" "}
                      <span className="font-medium">{group.question_id || "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">卷类:</span>{" "}
                      <span className="font-medium">{group.question_category || group.category || "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">语言:</span>{" "}
                      <span className="font-medium">{group.locale}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Hash:</span>{" "}
                      <code className="text-xs bg-gray-100 px-1 rounded">{group.content_hash.slice(0, 12)}...</code>
                    </div>
                  </div>
                  {selectedReview.status === "pending" && (
                    <div className="flex items-center gap-2">
                      <button
                        className="px-3 py-1.5 rounded bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50"
                        onClick={() => approve(selectedReview.id)}
                        disabled={loading}
                      >
                        通过
                      </button>
                      <button
                        className="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50"
                        onClick={() => reject(selectedReview.id)}
                        disabled={loading}
                      >
                        驳回
                      </button>
                    </div>
                  )}
                </div>

                {/* 原题干 */}
                <div className="mb-3">
                  <div className="text-sm font-semibold text-gray-700 mb-1">原题干:</div>
                  <div className="bg-gray-50 border border-gray-200 rounded p-2 text-sm whitespace-pre-wrap">
                    {originalContent || "—"}
                  </div>
                  {originalOptions && originalOptions.length > 0 && (
                    <div className="mt-2">
                      <div className="text-sm font-semibold text-gray-700 mb-1">原选项:</div>
                      <ul className="bg-gray-50 border border-gray-200 rounded p-2 text-sm list-disc list-inside">
                        {originalOptions.map((opt, idx) => (
                          <li key={idx}>{opt}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {originalExplanation && (
                    <div className="mt-2">
                      <div className="text-sm font-semibold text-gray-700 mb-1">原解析:</div>
                      <div className="bg-gray-50 border border-gray-200 rounded p-2 text-sm whitespace-pre-wrap">
                        {originalExplanation}
                      </div>
                    </div>
                  )}
                </div>

                {/* 多次润色版本选择 */}
                {group.reviews.length > 1 && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
                    <div className="text-sm font-semibold text-gray-700 mb-2">
                      润色版本选择 ({group.reviews.length} 个版本):
                    </div>
                    <div className="space-y-2">
                      {group.reviews.map((review) => (
                        <label
                          key={review.id}
                          className="flex items-start gap-2 p-2 bg-white rounded border cursor-pointer hover:bg-gray-50"
                        >
                          <input
                            type="radio"
                            name={`review-${group.content_hash}-${group.locale}`}
                            checked={group.selectedReviewId === review.id}
                            onChange={() => {
                              setGroupedReviews(prev =>
                                prev.map(g =>
                                  g.content_hash === group.content_hash && g.locale === group.locale
                                    ? { ...g, selectedReviewId: review.id }
                                    : g
                                )
                              );
                            }}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-xs">
                              <span className={`px-2 py-0.5 rounded ${
                                review.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                                review.status === "approved" ? "bg-green-100 text-green-800" :
                                "bg-red-100 text-red-800"
                              }`}>
                                {review.status === "pending" ? "待审核" : review.status === "approved" ? "已通过" : "已驳回"}
                              </span>
                              <span className="text-gray-500">
                                {new Date(review.created_at).toLocaleString("zh-CN")}
                              </span>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* 润色后的内容 */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-semibold text-gray-700">润色后的题干:</div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600">润色必要性评级 (1-10):</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          defaultValue="5"
                          className="w-16 px-2 py-1 border rounded text-sm"
                          placeholder="5"
                        />
                      </div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded p-2 text-sm whitespace-pre-wrap">
                      {selectedReview.proposed_content}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      说明润色的必要性（替换原题干文案的必要性）：
                    </div>
                    <textarea
                      className="w-full mt-1 px-2 py-1 border rounded text-xs"
                      rows={2}
                      placeholder="请说明为什么需要替换原题干文案..."
                    />
                  </div>

                  {selectedReview.proposed_options && selectedReview.proposed_options.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold text-gray-700 mb-1">润色后的选项:</div>
                      <ul className="bg-green-50 border border-green-200 rounded p-2 text-sm list-disc list-inside">
                        {selectedReview.proposed_options.map((opt, idx) => (
                          <li key={idx}>{opt}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedReview.proposed_explanation && (
                    <div>
                      <div className="text-sm font-semibold text-gray-700 mb-1">润色后的解析:</div>
                      <div className="bg-green-50 border border-green-200 rounded p-2 text-sm whitespace-pre-wrap">
                        {selectedReview.proposed_explanation}
                      </div>
                    </div>
                  )}

                  {selectedReview.notes && (
                    <div className="text-xs text-gray-500 italic">
                      备注: {selectedReview.notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* 加载更多触发器 */}
          {hasMore && (
            <div ref={loadMoreRef} className="text-center py-4">
              {loadingMore && <div className="text-sm text-gray-500">加载中...</div>}
            </div>
          )}

          {!hasMore && groupedReviews.length > 0 && (
            <div className="text-center py-4 text-sm text-gray-500">
              已加载全部 {total} 条记录
            </div>
          )}
        </div>
      )}
    </div>
  );
}
