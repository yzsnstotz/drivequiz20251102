/**
 * ✅ Dynamic Route Declaration
 * 防止 Next.js 静态预渲染报错 (DYNAMIC_SERVER_USAGE)
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserInfo } from "@/app/api/_lib/withUserAuth";
import type { AdContent, PaginationMeta } from "@/types/db";

/**
 * 统一成功响应
 */
function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

/**
 * 统一错误响应
 */
function err(errorCode: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, errorCode, message }, { status });
}

/**
 * GET /api/ads
 * 获取广告内容
 * 查询参数: ?position=license_top
 * 响应体: { ok: true, data: { id, title, image_url, link_url, ... } }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get("position")?.trim();

    if (!position) {
      return err("VALIDATION_FAILED", "position 参数是必需的", 400);
    }

    // 获取用户信息（可选，用于记录日志）
    const userInfo = await getUserInfo(request);
    const userId = userInfo?.userDbId || null;

    // 查询广告位
    const slot = await db
      .selectFrom("ad_slots")
      .select(["id", "position", "name", "status"])
      .where("position", "=", position)
      .where("status", "=", "active")
      .executeTakeFirst();

    if (!slot) {
      const response = ok(null); // 广告位不存在，返回 null
      response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
      return response;
    }

    // 查询该广告位下的有效广告内容
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ads = await db
      .selectFrom("ad_contents")
      .select([
        "id",
        "slot_id",
        "title",
        "title_ja",
        "title_zh",
        "title_en",
        "description",
        "description_ja",
        "description_zh",
        "description_en",
        "image_url",
        "video_url",
        "link_url",
        "priority",
        "weight",
        "impression_count",
        "click_count",
      ])
      .where("slot_id", "=", slot.id)
      .where("status", "=", "active")
      .where((eb) =>
        eb.or([
          eb("start_date", "is", null),
          eb("start_date", "<=", today),
        ])
      )
      .where((eb) =>
        eb.or([
          eb("end_date", "is", null),
          eb("end_date", ">=", today),
        ])
      )
      .orderBy("priority", "desc")
      .orderBy("weight", "desc")
      .execute();

    if (ads.length === 0) {
      const response = ok(null); // 没有可用广告，返回 null
      response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
      return response;
    }

    // 根据权重随机选择广告（权重越大，被选中的概率越高）
    const totalWeight = ads.reduce((sum, ad) => sum + (ad.weight || 1), 0);
    let random = Math.random() * totalWeight;
    let selectedAd = ads[0];

    for (const ad of ads) {
      random -= ad.weight || 1;
      if (random <= 0) {
        selectedAd = ad;
        break;
      }
    }

    // 记录展示日志（异步，不阻塞响应）
    if (selectedAd) {
      void (async () => {
        try {
          const ipAddress =
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            request.headers.get("x-real-ip")?.trim() ||
            null;
          const userAgent = request.headers.get("user-agent") || null;

          await db
            .insertInto("ad_logs")
            .values({
              ad_content_id: selectedAd.id,
              user_id: userId,
              log_type: "impression",
              ip_address: ipAddress,
              user_agent: userAgent,
              client_type: "web",
            })
            .execute();
        } catch (error) {
          console.error("[Ads API] Failed to log impression:", error);
        }
      })();
    }

    const response = ok({
      id: selectedAd.id,
      title: {
        default: selectedAd.title,
        ja: selectedAd.title_ja,
        zh: selectedAd.title_zh,
        en: selectedAd.title_en,
      },
      description: {
        default: selectedAd.description,
        ja: selectedAd.description_ja,
        zh: selectedAd.description_zh,
        en: selectedAd.description_en,
      },
      image_url: selectedAd.image_url,
      video_url: selectedAd.video_url,
      link_url: selectedAd.link_url,
      impression_count: selectedAd.impression_count,
      click_count: selectedAd.click_count,
    });
    // 添加 HTTP 缓存头：广告内容缓存 60 秒
    // s-maxage=60: CDN 缓存 60 秒
    // stale-while-revalidate=120: 过期后 2 分钟内仍可使用旧数据，后台更新
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return response;
  } catch (error) {
    console.error("[Ads API] GET error:", error);
    return err("INTERNAL_ERROR", "服务器内部错误", 500);
  }
}

/**
 * POST /api/ads/click
 * 记录广告点击
 * 请求体: { ad_id: number }
 * 响应体: { ok: true }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const adId = body.ad_id;

    if (!adId || typeof adId !== "number") {
      return err("VALIDATION_FAILED", "ad_id 必须是数字", 400);
    }

    // 获取用户信息（可选）
    const userInfo = await getUserInfo(request);
    const userId = userInfo?.userDbId || null;

    // 验证广告是否存在
    const ad = await db
      .selectFrom("ad_contents")
      .select(["id", "status"])
      .where("id", "=", adId)
      .where("status", "=", "active")
      .executeTakeFirst();

    if (!ad) {
      return err("NOT_FOUND", "广告不存在或已停用", 404);
    }

    // 记录点击日志
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      null;
    const userAgent = request.headers.get("user-agent") || null;

    await db
      .insertInto("ad_logs")
      .values({
        ad_content_id: adId,
        user_id: userId,
        log_type: "click",
        ip_address: ipAddress,
        user_agent: userAgent,
        client_type: "web",
      })
      .execute();

    return ok({ success: true });
  } catch (error) {
    console.error("[Ads API] POST error:", error);
    return err("INTERNAL_ERROR", "服务器内部错误", 500);
  }
}

