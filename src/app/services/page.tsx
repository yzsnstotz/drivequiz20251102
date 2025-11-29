"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient.front";
import Header from "@/components/common/Header";
import AdSlot from "@/components/common/AdSlot";
import AIButton from "@/components/common/AIButton";
import Pagination, { PaginationMeta } from "@/components/common/Pagination";
import FilterBar, { ServiceFilters } from "@/components/common/FilterBar";
import ServiceCard, { Service } from "@/components/service/ServiceCard";

// 缓存和请求去重机制（组件外部定义，避免每次渲染重新创建）
const serviceCache = new Map<string, { data: Service[]; pagination: PaginationMeta | null; timestamp: number }>();
const SERVICE_CACHE_TTL = 60 * 1000; // 1 分钟

const pendingServiceRequests = new Map<string, Promise<any>>();

// 请求去重函数
const fetchServicesWithDedup = async (url: string) => {
  // 如果已有相同请求在进行，等待它完成
  if (pendingServiceRequests.has(url)) {
    return pendingServiceRequests.get(url);
  }
  
  const promise = apiFetch<Service[]>(url)
    .then(response => response)
    .catch(err => {
      throw err;
    })
    .finally(() => {
      pendingServiceRequests.delete(url);
    });
  
  pendingServiceRequests.set(url, promise);
  return promise;
};

export default function ServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ServiceFilters>({
    category: "",
    location: "",
    prefecture: "",
    city: "",
  });

  const loadServices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const query: Record<string, string | number> = {
        page,
        limit: 20,
        status: "active",
      };
      if (filters.category) query.category = filters.category;
      if (filters.location) query.location = filters.location;
      if (filters.prefecture) query.prefecture = filters.prefecture;
      if (filters.city) query.city = filters.city;

      const queryString = new URLSearchParams(
        Object.entries(query).reduce((acc, [k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            acc[k] = String(v);
          }
          return acc;
        }, {} as Record<string, string>)
      ).toString();

      const fullUrl = queryString ? `/api/services?${queryString}` : "/api/services";
      
      // 检查缓存
      const now = Date.now();
      const cached = serviceCache.get(fullUrl);
      
      if (cached && (now - cached.timestamp < SERVICE_CACHE_TTL)) {
        // 使用缓存
        setServices(cached.data);
        setPagination(cached.pagination);
        setLoading(false);
        return;
      }
      
      // 缓存失效，请求 API（使用请求去重）
      const response = await fetchServicesWithDedup(fullUrl);

      if (!response.ok) {
        throw new Error(response.message || "加载服务列表失败");
      }

      const servicesData = response.data ?? [];
      const paginationData = response.pagination ? {
        page: response.pagination.page,
        limit: response.pagination.limit,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
      } : null;
      
      // 更新缓存
      serviceCache.set(fullUrl, { data: servicesData, pagination: paginationData, timestamp: now });
      
      setServices(servicesData);
      setPagination(paginationData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载服务列表失败");
      setServices([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFilterChange = (newFilters: ServiceFilters) => {
    setFilters(newFilters);
    setPage(1); // 重置到第一页
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <Header title="服务信息" showAIButton={true} aiContext="service" />
      
      {/* 广告位 */}
      <div className="container mx-auto px-4 py-4">
        <AdSlot position="service_list" />
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* 筛选栏 */}
        <FilterBar
          filters={filters}
          onChange={(newFilters) => handleFilterChange(newFilters as ServiceFilters)}
          type="service"
        />

        {/* AI推荐按钮 */}
        <div className="mb-6 flex justify-end">
          <AIButton context="service" />
        </div>

        {/* 服务列表 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-ios-dark-text-secondary">加载中...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={loadServices}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              重试
            </button>
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-ios-dark-text-secondary">暂无服务信息</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>

            {/* 分页 */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-6">
                <Pagination meta={pagination} onPageChange={handlePageChange} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

