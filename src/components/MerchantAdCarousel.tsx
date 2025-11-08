"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MerchantAd {
  id: number;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  imageUrl: string | null;
  category: string | null;
  adSlot: string | null;
  adStartDate: string | null;
  adEndDate: string | null;
}

interface MerchantAdCarouselProps {
  adSlot?: string; // 广告位（优先使用）
  category?: string; // 商家分类（已废弃，保留以兼容旧代码）
  title: string;
  description?: string;
}

function MerchantAdCarousel({ adSlot, category, title, description }: MerchantAdCarouselProps) {
  const [loading, setLoading] = useState(true);
  const [merchants, setMerchants] = useState<MerchantAd[]>([]);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMerchants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adSlot, category]);

  const loadMerchants = async () => {
    try {
      setLoading(true);
      // 优先使用广告位，如果没有则使用分类（兼容旧代码）
      const params = adSlot 
        ? `adSlot=${encodeURIComponent(adSlot)}`
        : category 
        ? `category=${encodeURIComponent(category)}`
        : "";
      const res = await fetch(`/api/merchant-ads?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setMerchants(data.data.items || []);
        }
      }
    } catch (error) {
      console.error("加载商家广告失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -300, behavior: "smooth" });
    }
  };

  const handleNext = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 300, behavior: "smooth" });
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setTouchEnd(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    if (Math.abs(distance) > 75) {
      if (distance > 0) {
        handleNext();
      } else {
        handlePrevious();
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  const handleMerchantClick = (merchant: MerchantAd) => {
    // 可以跳转到商家详情页或打开联系方式
    if (merchant.phone) {
      window.location.href = `tel:${merchant.phone}`;
    } else if (merchant.email) {
      window.location.href = `mailto:${merchant.email}`;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm">
        <div className="text-center text-gray-500 py-8">加载中...</div>
      </div>
    );
  }

  if (merchants.length === 0) {
    return null; // 没有广告时不显示
  }

  return (
    <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        {description && (
          <p className="text-gray-600 text-sm mt-1">{description}</p>
        )}
      </div>
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex overflow-x-auto space-x-4 pb-4 scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {merchants.map((merchant) => (
            <div
              key={merchant.id}
              className="flex-none w-[300px] cursor-pointer"
              onClick={() => handleMerchantClick(merchant)}
            >
              <div className="relative h-40 rounded-xl overflow-hidden">
                {merchant.imageUrl ? (
                  <Image
                    src={merchant.imageUrl}
                    alt={merchant.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 300px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                    <div className="text-white text-center">
                      <h3 className="text-2xl font-bold mb-2">{merchant.name}</h3>
                      {merchant.description && (
                        <p className="text-sm opacity-90">{merchant.description}</p>
                      )}
                    </div>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                  <h3 className="text-white font-bold mb-1">{merchant.name}</h3>
                  {merchant.description && (
                    <p className="text-white/90 text-sm">{merchant.description}</p>
                  )}
                  {merchant.address && (
                    <p className="text-white/90 text-xs mt-1">📍 {merchant.address}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Navigation Buttons */}
        {merchants.length > 1 && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/30 hover:bg-white/50 rounded-full p-2 backdrop-blur-sm transition-colors"
            >
              <ChevronLeft className="h-6 w-6 text-white" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/30 hover:bg-white/50 rounded-full p-2 backdrop-blur-sm transition-colors"
            >
              <ChevronRight className="h-6 w-6 text-white" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default MerchantAdCarousel;

