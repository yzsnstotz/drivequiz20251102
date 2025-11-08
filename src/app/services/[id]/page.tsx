"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiGet } from "@/lib/apiClient.front";
import Header from "@/components/common/Header";
import AdSlot from "@/components/common/AdSlot";
import AIButton from "@/components/common/AIButton";
import { ArrowLeft, MapPin, Phone, Mail, Globe, Star, Clock } from "lucide-react";

interface ServiceDetail {
  id: number;
  name: {
    default?: string;
    ja?: string;
    zh?: string;
    en?: string;
  };
  description: {
    default?: string;
    ja?: string;
    zh?: string;
    en?: string;
  };
  location: {
    address?: string;
    location?: string;
    prefecture?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  contact: {
    phone?: string;
    email?: string;
    website?: string;
  };
  price: {
    min?: number;
    max?: number;
    unit?: string;
  };
  rating: {
    avg?: number;
    count?: number;
  };
  image_url?: string;
  official_url?: string;
  business_hours?: any;
  features?: any;
  category?: {
    name: string;
    name_ja?: string;
    name_zh?: string;
    name_en?: string;
  };
  reviews?: Array<{
    id: number;
    rating: number;
    comment?: string;
    created_at: string;
  }>;
}

export default function ServiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const serviceId = params?.id as string;
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadService = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet<ServiceDetail>(`/api/services/${serviceId}`);
      setService(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载服务详情失败");
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    if (serviceId) {
      loadService();
    }
  }, [serviceId, loadService]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="服务详情" showAIButton={true} aiContext="service" />
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="服务详情" showAIButton={true} aiContext="service" />
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-red-600 mb-4">{error || "服务不存在"}</p>
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
      <Header title="服务详情" showAIButton={true} aiContext="service" />
      
      {/* 广告位 */}
      <div className="container mx-auto px-4 py-4">
        <AdSlot position="service_detail" />
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
          {service.image_url && (
            // eslint-disable-next-line @next/next/no-img-element -- 服务图片可能来自动态第三方域名，未知尺寸
            <img
              src={service.image_url}
              alt={service.name.zh || service.name.ja || service.name.default || "服务"}
              className="w-full h-64 md:h-96 object-cover"
            />
          )}

          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {service.name.zh || service.name.ja || service.name.default || "服务"}
                </h1>
                {service.category && (
                  <p className="text-blue-600 font-medium">
                    {service.category.name_zh || service.category.name_ja || service.category.name}
                  </p>
                )}
              </div>
              {service.rating && service.rating.avg && (
                <div className="flex items-center space-x-2">
                  <Star className="h-6 w-6 text-yellow-500 fill-current" />
                  <span className="text-2xl font-bold">{service.rating.avg.toFixed(1)}</span>
                  {service.rating.count && (
                    <span className="text-gray-600">({service.rating.count})</span>
                  )}
                </div>
              )}
            </div>

            {service.description && (service.description.zh || service.description.ja) && (
              <p className="text-gray-700 mb-6">
                {service.description.zh || service.description.ja || service.description.default}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* 位置信息 */}
              {service.location && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <MapPin className="h-5 w-5 mr-2" />
                    位置信息
                  </h2>
                  <dl className="space-y-2">
                    {service.location.address && (
                      <div>
                        <dt className="text-gray-600 text-sm">地址</dt>
                        <dd className="text-gray-900">{service.location.address}</dd>
                      </div>
                    )}
                    {(service.location.prefecture || service.location.city) && (
                      <div>
                        <dt className="text-gray-600 text-sm">地区</dt>
                        <dd className="text-gray-900">
                          {service.location.prefecture || ""} {service.location.city || ""}
                        </dd>
                      </div>
                    )}
                    {service.location.location && (
                      <div>
                        <dt className="text-gray-600 text-sm">位置</dt>
                        <dd className="text-gray-900">{service.location.location}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* 联系信息 */}
              {service.contact && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">联系信息</h2>
                  <dl className="space-y-2">
                    {service.contact.phone && (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2 text-gray-600" />
                        <a
                          href={`tel:${service.contact.phone}`}
                          className="text-blue-600 hover:underline"
                        >
                          {service.contact.phone}
                        </a>
                      </div>
                    )}
                    {service.contact.email && (
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-gray-600" />
                        <a
                          href={`mailto:${service.contact.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {service.contact.email}
                        </a>
                      </div>
                    )}
                    {service.contact.website && (
                      <div className="flex items-center">
                        <Globe className="h-4 w-4 mr-2 text-gray-600" />
                        <a
                          href={service.contact.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          访问网站
                        </a>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </div>

            {/* 价格信息 */}
            {service.price && service.price.min && service.price.max && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">价格信息</h2>
                <p className="text-2xl font-bold text-gray-900">
                  ¥{service.price.min.toLocaleString()} - ¥{service.price.max.toLocaleString()}
                  {service.price.unit && ` ${service.price.unit}`}
                </p>
              </div>
            )}

            {/* 营业时间 */}
            {service.business_hours && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  营业时间
                </h2>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                    {JSON.stringify(service.business_hours, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* 评价 */}
            {service.reviews && service.reviews.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">用户评价</h2>
                <div className="space-y-4">
                  {service.reviews.map((review) => (
                    <div key={review.id} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center mb-2">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating
                                  ? "text-yellow-500 fill-current"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="ml-2 text-sm text-gray-600">
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-gray-700">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex space-x-4">
              {service.official_url && (
                <a
                  href={service.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  官方网站
                </a>
              )}
            </div>
          </div>
        </div>

        {/* AI推荐 */}
        <div className="mt-6 flex justify-center">
          <AIButton context="service" />
        </div>
      </div>
    </div>
  );
}

