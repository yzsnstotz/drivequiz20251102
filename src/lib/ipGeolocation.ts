// ============================================================
// 文件路径: src/lib/ipGeolocation.ts
// 功能: IP地址地理位置查询工具
// ============================================================

import { apiGet } from "./apiClient";

export interface IPGeolocationInfo {
  country?: string;
  region?: string;
  city?: string;
  displayName: string; // 显示名称（如：中国·北京）
  rawIP: string; // 原始IP地址
}

// IP地理位置缓存（避免重复请求）
const geolocationCache = new Map<string, IPGeolocationInfo>();

/**
 * 根据IP地址获取地理位置信息
 * 使用 ip-api.com 免费API（无需API key）
 */
export async function getIPGeolocation(ip: string): Promise<IPGeolocationInfo | null> {
  if (!ip || ip === "-" || ip === "unknown" || ip.trim() === "") {
    return null;
  }

  // 检查缓存
  if (geolocationCache.has(ip)) {
    return geolocationCache.get(ip)!;
  }

  try {
    // 使用后端API代理，避免CORS问题
    // 使用 apiGet 自动添加 Authorization 头
    const result = await apiGet<IPGeolocationInfo>(
      `/api/admin/ip-geolocation`,
      {
        query: { ip },
      }
    );

    if (result.ok && result.data) {
      const data = result.data;
      const info: IPGeolocationInfo = {
        country: data.country,
        region: data.region,
        city: data.city,
        displayName: data.displayName,
        rawIP: data.rawIP || ip,
      };

      // 缓存结果
      geolocationCache.set(ip, info);
      return info;
    } else {
      // API返回失败，返回基本信息
      const info: IPGeolocationInfo = {
        displayName: "未知位置",
        rawIP: ip,
      };
      geolocationCache.set(ip, info);
      return info;
    }
  } catch (error: any) {
    console.error(`[IP Geolocation] Failed to fetch location for IP ${ip}:`, error);
    
    // 如果是认证错误（401），返回特殊提示
    if (error?.status === 401 || error?.errorCode === "AUTH_REQUIRED") {
      console.warn(`[IP Geolocation] Authentication required for IP ${ip}`);
      const info: IPGeolocationInfo = {
        displayName: "需要登录",
        rawIP: ip,
      };
      geolocationCache.set(ip, info);
      return info;
    }
    
    // 其他错误，返回基本信息
    const info: IPGeolocationInfo = {
      displayName: "查询失败",
      rawIP: ip,
    };
    geolocationCache.set(ip, info);
    return info;
  }
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

/**
 * 检查是否为内网IP（IPv4）
 */
export function isPrivateIP(ip: string): boolean {
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
 * 批量获取IP地理位置（带缓存）
 */
export async function getMultipleIPGeolocations(
  ips: string[]
): Promise<Map<string, IPGeolocationInfo>> {
  const result = new Map<string, IPGeolocationInfo>();
  const uncachedIPs: string[] = [];

  // 先检查缓存
  for (const ip of ips) {
    if (geolocationCache.has(ip)) {
      result.set(ip, geolocationCache.get(ip)!);
    } else if (ip && ip !== "-" && ip !== "unknown" && ip.trim() !== "") {
      uncachedIPs.push(ip);
    }
  }

  // 批量获取未缓存的位置（注意：ip-api.com 免费API不支持批量，需要逐个请求）
  // 为了避免请求过快，可以添加延迟
  for (const ip of uncachedIPs) {
    try {
      const info = await getIPGeolocation(ip);
      if (info) {
        result.set(ip, info);
      }
      // 添加小延迟避免请求过快（免费API限制）
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`[IP Geolocation] Failed to fetch location for IP ${ip}:`, error);
    }
  }

  return result;
}

