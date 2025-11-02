/**
 * ✅ Dynamic Route Declaration
 * 防止 Next.js 静态预渲染报错 (DYNAMIC_SERVER_USAGE)
 * 原因: 本文件使用了 request.headers / nextUrl.searchParams 等动态上下文
 * 修复策略: 强制动态渲染 + 禁用缓存 + Node.js 运行时
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

// ============================================================
// 文件路径: src/app/api/admin/ip-geolocation/route.ts
// 功能: IP地理位置查询API（代理 ip-api.com）
// 规范: 避免CORS问题，使用后端代理
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";

// IP地理位置缓存（内存缓存，避免重复请求）
const geolocationCache = new Map<
  string,
  { country?: string; region?: string; city?: string; displayName: string }
>();

// 缓存过期时间（5分钟）
const CACHE_TTL = 5 * 60 * 1000;
const cacheTimestamps = new Map<string, number>();

/**
 * GET /api/admin/ip-geolocation?ip=xxx
 * 查询IP地理位置信息
 */
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const query = req.nextUrl.searchParams;
    const ip = query.get("ip")?.trim();

    if (!ip || ip === "-" || ip === "unknown" || ip === "") {
      return badRequest("IP address is required");
    }

    // 检查缓存
    const cached = geolocationCache.get(ip);
    const cacheTime = cacheTimestamps.get(ip);
    if (cached && cacheTime && Date.now() - cacheTime < CACHE_TTL) {
      return success(cached);
    }

    // 检查是否为内网IP
    const isPrivate = checkPrivateIP(ip);
    if (isPrivate) {
      const result = {
        displayName: "内网地址",
        rawIP: ip,
      };
      geolocationCache.set(ip, result);
      cacheTimestamps.set(ip, Date.now());
      return success(result);
    }

    // 调用 ip-api.com API（后端代理，避免CORS问题）
    try {
      // 创建超时控制器
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      let response: Response;
      try {
        response = await fetch(
          `http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city`,
          {
            method: "GET",
            headers: {
              "Accept": "application/json",
            },
            signal: controller.signal,
          }
        );
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "success") {
        const result = {
          country: data.country || undefined,
          region: data.regionName || undefined,
          city: data.city || undefined,
          displayName: formatLocationName(data.country, data.regionName, data.city),
          rawIP: ip,
        };

        // 缓存结果
        geolocationCache.set(ip, result);
        cacheTimestamps.set(ip, Date.now());

        return success(result);
      } else {
        // API返回失败，返回基本信息
        const result = {
          displayName: "未知位置",
          rawIP: ip,
        };
        geolocationCache.set(ip, result);
        cacheTimestamps.set(ip, Date.now());
        return success(result);
      }
    } catch (fetchError: any) {
      console.error(`[IP Geolocation] Failed to fetch location for IP ${ip}:`, fetchError);
      // 出错时返回基本信息
      const result = {
        displayName: "查询失败",
        rawIP: ip,
      };
      geolocationCache.set(ip, result);
      cacheTimestamps.set(ip, Date.now());
      return success(result);
    }
  } catch (err: any) {
    console.error("[GET /api/admin/ip-geolocation] Error:", err);
    if (err.ok === false) return err;
    return internalError("Failed to fetch IP geolocation");
  }
});

/**
 * 检查是否为内网IP（IPv4）
 */
function checkPrivateIP(ip: string): boolean {
  if (!ip || ip === "unknown") return false;

  // IPv4 内网地址段
  const privateRanges = [
    /^127\./, // 127.0.0.0/8 - Loopback
    /^10\./, // 10.0.0.0/8 - Private
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12 - Private
    /^192\.168\./, // 192.168.0.0/16 - Private
    /^::1$/, // IPv6 loopback
    /^fc00:/, // IPv6 private
    /^fe80:/, // IPv6 link-local
  ];

  return privateRanges.some((range) => range.test(ip));
}

/**
 * 格式化地理位置名称
 */
function formatLocationName(
  country?: string,
  region?: string,
  city?: string
): string {
  const parts: string[] = [];

  if (country) {
    parts.push(country);
  }

  if (region && region !== city) {
    parts.push(region);
  }

  if (city) {
    parts.push(city);
  }

  return parts.length > 0 ? parts.join(" · ") : "未知位置";
}

