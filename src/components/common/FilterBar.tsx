"use client";

import { useState } from "react";
import { Filter, Search, X } from "lucide-react";

export interface VehicleFilters {
  brand?: string;
  type?: string;
  minPrice?: string;
  maxPrice?: string;
}

export interface ServiceFilters {
  category?: string;
  location?: string;
  prefecture?: string;
  city?: string;
}

export type FilterBarFilters = VehicleFilters | ServiceFilters;

export interface FilterBarProps {
  filters: FilterBarFilters;
  onChange: (filters: FilterBarFilters) => void;
  type: "vehicle" | "service";
  className?: string;
}

/**
 * 统一筛选栏组件
 * 车辆/服务筛选：品牌、类别、价格、都道府县
 * 受控输入 + onChange(filters)
 */
export default function FilterBar({ filters, onChange, type, className = "" }: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState<FilterBarFilters>(filters);

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onChange(newFilters);
  };

  const handleReset = () => {
    const emptyFilters: FilterBarFilters = type === "vehicle" 
      ? { brand: "", type: "", minPrice: "", maxPrice: "" }
      : { category: "", location: "", prefecture: "", city: "" };
    setLocalFilters(emptyFilters);
    onChange(emptyFilters);
  };

  const hasActiveFilters = Object.values(localFilters).some((v) => v && v.trim() !== "");

  if (type === "vehicle") {
    const vehicleFilters = localFilters as VehicleFilters;
    return (
      <div className={`mb-6 ${className}`}>
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="搜索品牌或型号..."
              value={vehicleFilters.brand || ""}
              onChange={(e) => handleFilterChange("brand", e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
              hasActiveFilters
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            <Filter className="h-5 w-5" />
            <span>筛选</span>
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 bg-white text-blue-600 rounded-full text-xs font-semibold">
                {Object.values(vehicleFilters).filter((v) => v && v.trim() !== "").length}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="bg-white p-4 rounded-lg shadow-md mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">筛选条件</h3>
              <button
                onClick={handleReset}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
              >
                <X className="h-4 w-4" />
                <span>重置</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">车辆类型</label>
                <input
                  type="text"
                  value={vehicleFilters.type || ""}
                  onChange={(e) => handleFilterChange("type", e.target.value)}
                  placeholder="输入类型..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">最低价格</label>
                <input
                  type="number"
                  value={vehicleFilters.minPrice || ""}
                  onChange={(e) => handleFilterChange("minPrice", e.target.value)}
                  placeholder="最低价格"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">最高价格</label>
                <input
                  type="number"
                  value={vehicleFilters.maxPrice || ""}
                  onChange={(e) => handleFilterChange("maxPrice", e.target.value)}
                  placeholder="最高价格"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Service filters
  const serviceFilters = localFilters as ServiceFilters;
  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex items-center space-x-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="搜索服务名称或位置..."
            value={serviceFilters.location || ""}
            onChange={(e) => handleFilterChange("location", e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
            hasActiveFilters
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          <Filter className="h-5 w-5" />
          <span>筛选</span>
          {hasActiveFilters && (
            <span className="ml-1 px-1.5 py-0.5 bg-white text-blue-600 rounded-full text-xs font-semibold">
              {Object.values(serviceFilters).filter((v) => v && v.trim() !== "").length}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-md mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">筛选条件</h3>
            <button
              onClick={handleReset}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
            >
              <X className="h-4 w-4" />
              <span>重置</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">服务分类</label>
              <input
                type="text"
                value={serviceFilters.category || ""}
                onChange={(e) => handleFilterChange("category", e.target.value)}
                placeholder="输入分类..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">都道府县</label>
              <input
                type="text"
                value={serviceFilters.prefecture || ""}
                onChange={(e) => handleFilterChange("prefecture", e.target.value)}
                placeholder="输入都道府县..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">城市</label>
              <input
                type="text"
                value={serviceFilters.city || ""}
                onChange={(e) => handleFilterChange("city", e.target.value)}
                placeholder="输入城市..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

