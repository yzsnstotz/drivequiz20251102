"use client";

import { useEffect, useState, useRef } from "react";
import { apiGet } from "@/lib/apiClient.front";
import { getCachedImage, cacheImage } from "@/lib/imageCache";

interface AdContent {
  id: number;
  title: {
    default?: string;
    ja?: string;
    zh?: string;
    en?: string;
  };
  description?: {
    default?: string;
    ja?: string;
    zh?: string;
    en?: string;
  };
  image_url?: string;
  video_url?: string;
  link_url?: string;
  impression_count?: number;
  click_count?: number;
}

interface AdSlotProps {
  position: string; // 广告位位置标识：license_top, vehicle_list, service_detail, etc.
  className?: string;
  onAdClick?: (adId: number) => void;
}

/**
 * 广告位组件
 * 自动从 API 拉取广告内容并展示
 */
export default function AdSlot({ position, className = "", onAdClick }: AdSlotProps) {
  const [ad, setAd] = useState<AdContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cachedImageUrl, setCachedImageUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    async function loadAd() {
      try {
        setLoading(true);
        setError(null);
        const adContent = await apiGet<AdContent>(`/api/ads`, {
          query: { position },
        });
        
        // 检查是否已取消
        if (cancelled) return;
        
        setAd(adContent);
        
        // 如果有图片，预加载并缓存
        if (adContent?.image_url) {
          try {
            // 先检查缓存
            const cachedUrl = await getCachedImage(adContent.image_url);
            if (cachedUrl) {
              // 使用缓存的图片
              if (cancelled) {
                URL.revokeObjectURL(cachedUrl);
                return;
              }
              setCachedImageUrl(cachedUrl);
              blobUrlRef.current = cachedUrl;
            } else {
              // 缓存中没有，加载并缓存
              await cacheImage(adContent.image_url);
              // 重新获取缓存（刚刚存储的）
              const newCachedUrl = await getCachedImage(adContent.image_url);
              if (newCachedUrl && !cancelled) {
                setCachedImageUrl(newCachedUrl);
                blobUrlRef.current = newCachedUrl;
              }
            }
          } catch (err) {
            console.warn("[AdSlot] Failed to cache image:", err);
            // 缓存失败不影响图片显示，使用原始 URL
            setCachedImageUrl(null);
          }
        }
      } catch (err: any) {
        // 如果请求被取消，不显示错误
        if (cancelled || err?.errorCode === "REQUEST_ABORTED") {
          return;
        }
        
        // 静默处理错误，不显示给用户
        console.warn("[AdSlot] Failed to load ad:", err);
        setError(null); // 不设置错误，静默失败
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAd();
    
    // 清理函数：标记为已取消，清理 Blob URL
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [position]);

  const handleClick = async () => {
    if (!ad || !ad.link_url) return;

    // 记录点击日志
    try {
      await fetch("/api/ads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ad_id: ad.id }),
      });
    } catch (err) {
      console.error("[AdSlot] Failed to log click:", err);
    }

    // 触发回调
    if (onAdClick) {
      onAdClick(ad.id);
    }

    // 打开链接
    if (ad.link_url) {
      window.open(ad.link_url, "_blank", "noopener,noreferrer");
    }
  };

  if (loading) {
    return (
      <div className={`ad-slot-loading ${className}`}>
        <div className="animate-pulse bg-gray-200 h-32 rounded"></div>
      </div>
    );
  }

  if (error || !ad) {
    return null; // 没有广告时不显示任何内容
  }

  return (
    <div className={`ad-slot ${className}`}>
      {ad.image_url && (
        <div
          className="cursor-pointer"
          onClick={handleClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClick();
            }
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 广告图片可能来自动态第三方域名，未知尺寸 */}
          <img
            src={cachedImageUrl || ad.image_url}
            alt={ad.title.default || ad.title.ja || "Advertisement"}
            className="w-full h-auto rounded"
            onLoad={() => {
              // 图片加载成功后，如果还没有缓存，异步缓存
              if (!cachedImageUrl && ad.image_url) {
                cacheImage(ad.image_url).catch((err) => {
                  console.warn("[AdSlot] Failed to cache image on load:", err);
                });
              }
            }}
            onError={() => {
              // 如果缓存的图片加载失败，回退到原始 URL
              if (cachedImageUrl) {
                setCachedImageUrl(null);
              }
            }}
          />
        </div>
      )}
      {ad.video_url && (
        <div className="cursor-pointer" onClick={handleClick}>
          <video
            src={ad.video_url}
            className="w-full h-auto rounded"
            controls={false}
            autoPlay
            loop
            muted
          />
        </div>
      )}
    </div>
  );
}

