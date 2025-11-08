"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

interface MerchantAd {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
}

interface SplashScreenAdProps {
  duration: number; // 持续时间（秒）
  onClose: () => void;
}

export default function SplashScreenAd({ duration, onClose }: SplashScreenAdProps) {
  const [merchant, setMerchant] = useState<MerchantAd | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(duration);

  useEffect(() => {
    loadAd();
  }, []);

  useEffect(() => {
    if (merchant && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (merchant && countdown === 0) {
      onClose();
    }
  }, [countdown, merchant, onClose]);

  const loadAd = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/merchant-ads?adSlot=splash_screen");
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.data.items && data.data.items.length > 0) {
          // 随机选择一个广告
          const items = data.data.items;
          const randomItem = items[Math.floor(Math.random() * items.length)];
          setMerchant(randomItem);
        } else {
          // 没有广告，直接关闭
          onClose();
        }
      } else {
        // 请求失败，直接关闭
        onClose();
      }
    } catch (error) {
      console.error("加载启动页广告失败:", error);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // 如果正在加载，显示加载状态
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  // 如果没有广告，不显示
  if (!merchant) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
      <div className="relative w-full h-full">
        {merchant.imageUrl ? (
          <Image
            src={merchant.imageUrl}
            alt={merchant.name}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
            <div className="text-white text-center">
              <h3 className="text-3xl font-bold mb-4">{merchant.name}</h3>
              {merchant.description && (
                <p className="text-lg opacity-90">{merchant.description}</p>
              )}
            </div>
          </div>
        )}
        {/* 倒计时和关闭按钮 */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
          >
            跳过 {countdown}s
          </button>
        </div>
      </div>
    </div>
  );
}

