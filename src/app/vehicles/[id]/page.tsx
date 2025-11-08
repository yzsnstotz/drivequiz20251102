"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiGet } from "@/lib/apiClient.front";
import Header from "@/components/common/Header";
import AdSlot from "@/components/common/AdSlot";
import AIButton from "@/components/common/AIButton";
import { ArrowLeft } from "lucide-react";

interface VehicleDetail {
  id: number;
  brand: string;
  model: string;
  year?: number;
  name: {
    ja?: string;
    zh?: string;
    en?: string;
  };
  description: {
    ja?: string;
    zh?: string;
    en?: string;
  };
  price: {
    min?: number;
    max?: number;
  };
  fuel_type?: string;
  transmission?: string;
  seats?: number;
  image_url?: string;
  official_url?: string;
  dealer_url?: string;
  specifications?: any;
  type?: {
    name: string;
    name_ja?: string;
    name_zh?: string;
    name_en?: string;
  };
}

export default function VehicleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const vehicleId = params?.id as string;
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVehicle = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet<VehicleDetail>(`/api/vehicles/${vehicleId}`);
      setVehicle(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载车辆详情失败");
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    if (vehicleId) {
      loadVehicle();
    }
  }, [vehicleId, loadVehicle]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="车辆详情" showAIButton={true} aiContext="vehicle" />
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="车辆详情" showAIButton={true} aiContext="vehicle" />
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-red-600 mb-4">{error || "车辆不存在"}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="车辆详情" showAIButton={true} aiContext="vehicle" />
      
      {/* 广告位 */}
      <div className="container mx-auto px-4 py-4">
        <AdSlot position="vehicle_detail" />
      </div>

      <div className="container mx-auto px-4 py-6">
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          返回列表
        </button>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {vehicle.image_url && (
            // eslint-disable-next-line @next/next/no-img-element -- 车辆图片可能来自动态第三方域名，未知尺寸
            <img
              src={vehicle.image_url}
              alt={vehicle.name.zh || vehicle.name.ja || vehicle.brand}
              className="w-full h-64 md:h-96 object-cover"
            />
          )}

          <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {vehicle.name.zh || vehicle.name.ja || `${vehicle.brand} ${vehicle.model}`}
            </h1>

            {vehicle.description.zh || vehicle.description.ja ? (
              <p className="text-gray-700 mb-6">
                {vehicle.description.zh || vehicle.description.ja}
              </p>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">基本信息</h2>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">品牌</dt>
                    <dd className="text-gray-900 font-medium">{vehicle.brand}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">型号</dt>
                    <dd className="text-gray-900 font-medium">{vehicle.model}</dd>
                  </div>
                  {vehicle.year && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">年份</dt>
                      <dd className="text-gray-900 font-medium">{vehicle.year}</dd>
                    </div>
                  )}
                  {vehicle.type && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">类型</dt>
                      <dd className="text-gray-900 font-medium">
                        {vehicle.type.name_zh || vehicle.type.name_ja || vehicle.type.name}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">价格信息</h2>
                <dl className="space-y-2">
                  {vehicle.price.min && vehicle.price.max && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">价格范围</dt>
                      <dd className="text-gray-900 font-medium">
                        ¥{vehicle.price.min.toLocaleString()} - ¥{vehicle.price.max.toLocaleString()}
                      </dd>
                    </div>
                  )}
                  {vehicle.fuel_type && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">燃料类型</dt>
                      <dd className="text-gray-900 font-medium">{vehicle.fuel_type}</dd>
                    </div>
                  )}
                  {vehicle.transmission && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">变速器</dt>
                      <dd className="text-gray-900 font-medium">{vehicle.transmission}</dd>
                    </div>
                  )}
                  {vehicle.seats && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">座位数</dt>
                      <dd className="text-gray-900 font-medium">{vehicle.seats}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {vehicle.specifications && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">详细规格</h2>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                    {JSON.stringify(vehicle.specifications, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div className="flex space-x-4">
              {vehicle.official_url && (
                <a
                  href={vehicle.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  官方网站
                </a>
              )}
              {vehicle.dealer_url && (
                <a
                  href={vehicle.dealer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  经销商
                </a>
              )}
            </div>
          </div>
        </div>

        {/* AI推荐 */}
        <div className="mt-6 flex justify-center">
          <AIButton context="vehicle" />
        </div>
      </div>
    </div>
  );
}

