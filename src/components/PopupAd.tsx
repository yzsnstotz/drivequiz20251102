"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { fetchMerchantAds } from "@/lib/merchantAdsCache";

interface MerchantAd {
  id: number;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  imageUrl: string | null;
}

interface PopupAdProps {
  onClose: () => void;
}

export default function PopupAd({ onClose }: PopupAdProps) {
  const [merchant, setMerchant] = useState<MerchantAd | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 每次都显示弹窗广告，不检查localStorage
    loadAd();
  }, [onClose]);

  useEffect(() => {
    if (merchant) {
      // 延迟显示动画
      setTimeout(() => {
        setIsVisible(true);
      }, 100);
    }
  }, [merchant]);

  const loadAd = async () => {
    try {
      setLoading(true);
      // 使用缓存和去重机制获取数据
      const items = await fetchMerchantAds("popup_ad");
      if (items && items.length > 0) {
        // 随机选择一个广告
        const randomItem = items[Math.floor(Math.random() * items.length)];
        setMerchant(randomItem);
      } else {
        // 没有广告，直接关闭
        onClose();
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("加载弹窗广告失败:", error);
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    // 不保存到localStorage，每次都显示
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleMerchantClick = () => {
    if (merchant?.phone) {
      window.location.href = `tel:${merchant.phone}`;
    } else if (merchant?.email) {
      window.location.href = `mailto:${merchant.email}`;
    }
  };

  // 如果正在加载，不显示
  if (loading) {
    return null;
  }

  // 如果没有广告，不显示
  if (!merchant) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
      {/* 背景遮罩 */}
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />
      
      {/* 弹窗内容 */}
      <div
        className={`relative w-full max-w-md pointer-events-auto transition-transform duration-300 ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* 外层结构 - 淡色，接近页面颜色 */}
        <div className="bg-gray-50 rounded-t-[40px] p-6 shadow-2xl">
          {/* 内层结构 - 亚金黄色 */}
          <div className="bg-gradient-to-br from-amber-100 to-yellow-50 rounded-[30px] p-6 border-2 border-amber-200">
            {/* 关闭按钮 */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/80 rounded-full hover:bg-white transition-colors z-10"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            {/* 广告标题 - 内层上部 */}
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-900">{merchant.name}</h3>
            </div>

            {/* 广告内容 */}
            <div className="space-y-3">
              {merchant.imageUrl && (
                <div className="relative w-full h-48 rounded-xl overflow-hidden">
                  <Image
                    src={merchant.imageUrl}
                    alt={merchant.name}
                    fill
                    sizes="100vw"
                    className="object-cover"
                  />
                </div>
              )}
              
              {merchant.description && (
                <p className="text-gray-700 text-sm leading-relaxed">{merchant.description}</p>
              )}

              {merchant.address && (
                <p className="text-gray-600 text-xs">📍 {merchant.address}</p>
              )}

              {(merchant.phone || merchant.email) && (
                <button
                  onClick={handleMerchantClick}
                  className="w-full mt-4 px-4 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
                >
                  {merchant.phone ? "立即联系" : "发送邮件"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

