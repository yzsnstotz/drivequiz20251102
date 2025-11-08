"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPut } from "@/lib/apiClient.front";
import Header from "@/components/common/Header";

interface QuestionnaireData {
  nationality?: string;
  goals?: string[];
  level?: "beginner" | "intermediate" | "advanced" | "expert";
  vehicle_brands?: string[];
  service_types?: string[];
}

const nationalityOptions = [
  "中国", "日本", "韩国", "美国", "英国", "其他"
];

const goalOptions = [
  "取得仮免许", "取得本免许", "外国驾照切换", "取得二种驾照", "重新取得驾照", "其他"
];

const vehicleBrandOptions = [
  "Toyota", "Nissan", "Honda", "Mazda", "Subaru", "Suzuki", "其他"
];

const serviceTypeOptions = [
  "车检", "保险", "维修", "驾校", "其他"
];

export default function QuestionnairePage() {
  const router = useRouter();
  const [formData, setFormData] = useState<QuestionnaireData>({
    goals: [],
    vehicle_brands: [],
    service_types: [],
    level: "beginner",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // 保存用户资料
      await apiPut("/api/profile", {
        goals: formData.goals,
        level: formData.level,
      });

      // 保存用户兴趣
      await apiPut("/api/interests", {
        vehicle_brands: formData.vehicle_brands,
        service_types: formData.service_types,
      });

      // 跳转到首页
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存问卷失败");
    } finally {
      setLoading(false);
    }
  };

  const toggleArrayItem = (array: string[] | undefined, item: string): string[] => {
    const current = array || [];
    if (current.includes(item)) {
      return current.filter((i) => i !== item);
    }
    return [...current, item];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="用户问卷" showAIButton={false} />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">用户问卷</h1>
          <p className="text-gray-600 mb-6">请填写以下信息，帮助我们为您提供更好的服务</p>

          {/* 国籍 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              您的国籍
            </label>
            <select
              value={formData.nationality || ""}
              onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">请选择</option>
              {nationalityOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* 目标 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              您的目标（可多选）
            </label>
            <div className="space-y-2">
              {goalOptions.map((goal) => (
                <label key={goal} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.goals?.includes(goal) || false}
                    onChange={() =>
                      setFormData({
                        ...formData,
                        goals: toggleArrayItem(formData.goals, goal),
                      })
                    }
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">{goal}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 水平 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              您的水平
            </label>
            <select
              value={formData.level || "beginner"}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  level: e.target.value as QuestionnaireData["level"],
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="beginner">初学者</option>
              <option value="intermediate">中级</option>
              <option value="advanced">高级</option>
              <option value="expert">专家</option>
            </select>
          </div>

          {/* 车辆品牌兴趣 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              感兴趣的车辆品牌（可多选）
            </label>
            <div className="space-y-2">
              {vehicleBrandOptions.map((brand) => (
                <label key={brand} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.vehicle_brands?.includes(brand) || false}
                    onChange={() =>
                      setFormData({
                        ...formData,
                        vehicle_brands: toggleArrayItem(formData.vehicle_brands, brand),
                      })
                    }
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">{brand}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 服务类型兴趣 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              感兴趣的服务类型（可多选）
            </label>
            <div className="space-y-2">
              {serviceTypeOptions.map((type) => (
                <label key={type} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.service_types?.includes(type) || false}
                    onChange={() =>
                      setFormData({
                        ...formData,
                        service_types: toggleArrayItem(formData.service_types, type),
                      })
                    }
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex space-x-4">
            <button
              onClick={() => router.back()}
              className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              跳过
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "保存中..." : "提交"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

