"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient.front";
import Header from "@/components/common/Header";
import AdSlot from "@/components/common/AdSlot";
import AIButton from "@/components/common/AIButton";
import Pagination, { PaginationMeta } from "@/components/common/Pagination";
import FilterBar, { VehicleFilters } from "@/components/common/FilterBar";
import VehicleCard, { Vehicle } from "@/components/vehicle/VehicleCard";

export default function VehiclesPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<VehicleFilters>({
    brand: "",
    type: "",
    minPrice: "",
    maxPrice: "",
  });

  const loadVehicles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const query: Record<string, string | number> = {
        page,
        limit: 20,
        status: "active",
      };
      if (filters.brand) query.brand = filters.brand;
      if (filters.type) query.type = filters.type;
      if (filters.minPrice) query.minPrice = filters.minPrice;
      if (filters.maxPrice) query.maxPrice = filters.maxPrice;

      const queryString = new URLSearchParams(
        Object.entries(query).reduce((acc, [k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            acc[k] = String(v);
          }
          return acc;
        }, {} as Record<string, string>)
      ).toString();

      const fullUrl = queryString ? `/api/vehicles?${queryString}` : "/api/vehicles";
      const response = await apiFetch<Vehicle[]>(fullUrl);

      setVehicles(response.data || []);
      if (response.pagination) {
        setPagination({
          page: response.pagination.page,
          limit: response.pagination.limit,
          total: response.pagination.total,
          totalPages: response.pagination.totalPages,
        });
      } else {
        setPagination(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载车辆列表失败");
      setVehicles([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFilterChange = (newFilters: VehicleFilters) => {
    setFilters(newFilters);
    setPage(1); // 重置到第一页
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="车辆信息" showAIButton={true} aiContext="vehicle" />
      
      {/* 广告位 */}
      <div className="container mx-auto px-4 py-4">
        <AdSlot position="vehicle_list" />
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* 筛选栏 */}
        <FilterBar filters={filters} onChange={handleFilterChange} type="vehicle" />

        {/* AI推荐按钮 */}
        <div className="mb-6 flex justify-end">
          <AIButton context="vehicle" />
        </div>

        {/* 车辆列表 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">加载中...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">{error}</p>
            <button
              onClick={loadVehicles}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              重试
            </button>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">暂无车辆信息</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vehicles.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
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

