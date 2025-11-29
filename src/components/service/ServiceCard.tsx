"use client";

import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { getMultilangContent } from "@/lib/multilangUtils";

export interface Service {
  id: number;
  name: {
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
  category?: {
    name: string;
    name_ja?: string;
    name_zh?: string;
    name_en?: string;
  };
}

export interface ServiceCardProps {
  service: Service;
  className?: string;
}

/**
 * 服务卡片组件
 */
export default function ServiceCard({ service, className = "" }: ServiceCardProps) {
  const { language } = useLanguage();

  // API 返回的格式是 { default, ja, zh, en }，需要转换为 { zh?, en?, ja? } 格式
  const getServiceName = () => {
    if (typeof service.name === "string") return service.name;
    if (service.name.default) {
      // 转换格式：{ default, ja, zh, en } -> { zh?, en?, ja? }
      const converted = {
        zh: service.name.zh || service.name.default,
        en: service.name.en,
        ja: service.name.ja,
      };
      return getMultilangContent(converted, language, service.name.default);
    }
    return getMultilangContent(service.name, language, "服务");
  };
  
  const displayName = getServiceName();
  
  const getCategoryName = () => {
    if (!service.category) return null;
    if (service.category.name_zh || service.category.name_ja || service.category.name_en) {
      const converted = {
        zh: service.category.name_zh,
        en: service.category.name_en,
        ja: service.category.name_ja,
      };
      return getMultilangContent(converted, language, service.category.name);
    }
    return service.category.name;
  };
  
  const displayCategory = getCategoryName();

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat(language === "ja" ? "ja-JP" : language === "zh" ? "zh-CN" : "en-US", {
      style: "currency",
      currency: "JPY",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Link
      href={`/services/${service.id}`}
      className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow ${className}`}
    >
      {service.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- 服务图片可能来自动态第三方域名，未知尺寸
        <img
          src={service.image_url}
          alt={displayName}
          className="w-full h-48 object-cover"
          loading="lazy"
        />
      )}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{displayName}</h3>
        {displayCategory && (
          <p className="text-sm text-blue-600 mb-2 font-medium">{displayCategory}</p>
        )}
        {service.location && (service.location.prefecture || service.location.city) && (
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
            <span className="truncate">
              {service.location.prefecture || ""} {service.location.city || ""}
            </span>
          </div>
        )}
        {service.rating && service.rating.avg && (
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Star className="h-4 w-4 mr-1 text-yellow-500 fill-current flex-shrink-0" />
            <span>{service.rating.avg.toFixed(1)}</span>
            {service.rating.count && (
              <span className="ml-1 text-gray-500">({service.rating.count})</span>
            )}
          </div>
        )}
        {service.price && service.price.min && service.price.max && (
          <p className="text-sm font-semibold text-gray-900">
            {formatPrice(service.price.min)} - {formatPrice(service.price.max)}
            {service.price.unit && ` ${service.price.unit}`}
          </p>
        )}
      </div>
    </Link>
  );
}

