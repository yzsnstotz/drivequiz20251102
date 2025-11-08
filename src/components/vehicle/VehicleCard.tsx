"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

export interface Vehicle {
  id: number;
  brand: string;
  model: string;
  year?: number;
  name: {
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
  type?: {
    name: string;
    name_ja?: string;
    name_zh?: string;
    name_en?: string;
  };
}

export interface VehicleCardProps {
  vehicle: Vehicle;
  className?: string;
}

/**
 * 车辆卡片组件
 */
export default function VehicleCard({ vehicle, className = "" }: VehicleCardProps) {
  const { t, language } = useLanguage();

  const displayName = vehicle.name.zh || vehicle.name.ja || `${vehicle.brand} ${vehicle.model}`;
  const displayType = vehicle.type
    ? t({
        ja: vehicle.type.name_ja,
        zh: vehicle.type.name_zh,
        en: vehicle.type.name_en,
        default: vehicle.type.name,
      })
    : null;

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat(language === "ja" ? "ja-JP" : language === "zh" ? "zh-CN" : "en-US", {
      style: "currency",
      currency: "JPY",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Link
      href={`/vehicles/${vehicle.id}`}
      className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow ${className}`}
    >
      {vehicle.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- 车辆图片可能来自动态第三方域名，未知尺寸
        <img
          src={vehicle.image_url}
          alt={displayName}
          className="w-full h-48 object-cover"
          loading="lazy"
        />
      )}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{displayName}</h3>
        {displayType && (
          <p className="text-sm text-blue-600 mb-2 font-medium">{displayType}</p>
        )}
        <div className="space-y-1 text-sm text-gray-600">
          <p>
            <span className="font-medium">品牌:</span> {vehicle.brand}
          </p>
          <p>
            <span className="font-medium">型号:</span> {vehicle.model}
          </p>
          {vehicle.year && (
            <p>
              <span className="font-medium">年份:</span> {vehicle.year}
            </p>
          )}
          {vehicle.price.min && vehicle.price.max && (
            <p>
              <span className="font-medium">价格:</span> {formatPrice(vehicle.price.min)} - {formatPrice(vehicle.price.max)}
            </p>
          )}
          {vehicle.fuel_type && (
            <p>
              <span className="font-medium">燃料:</span> {vehicle.fuel_type}
            </p>
          )}
          {vehicle.transmission && (
            <p>
              <span className="font-medium">变速器:</span> {vehicle.transmission}
            </p>
          )}
          {vehicle.seats && (
            <p>
              <span className="font-medium">座位数:</span> {vehicle.seats}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

