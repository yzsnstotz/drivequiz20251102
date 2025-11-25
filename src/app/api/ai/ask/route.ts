import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { db } from "@/lib/db";
import { aiDb } from "@/lib/aiDb";
import { calculateQuestionHash } from "@/lib/questionHash";
import {
  getAIAnswerFromDb,
  saveAIAnswerToDb,
  getAIAnswerFromJson,
} from "@/lib/questionDb";

// 用户缓存存储（内存缓存，按用户ID和题目hash存储）
// 格式：Map<userId, Map<questionHash, answer>>
const userAnswerCache = new Map<string, Map<string, string>>();

/**
 * 获取用户缓存的AI答案
 */
function getUserCachedAnswer(userId: string | null, questionHash: string): string | null {
  if (!userId || !questionHash) return null;
  const userCache = userAnswerCache.get(userId);
  if (!userCache) return null;
  return userCache.get(questionHash) || null;
}

/**
 * 存储用户缓存的AI答案
 */
function setUserCachedAnswer(userId: string | null, questionHash: string, answer: string): void {
  if (!userId || !questionHash || !answer) return;
  let userCache = userAnswerCache.get(userId);
  if (!userCache) {
    userCache = new Map();
    userAnswerCache.set(userId, userCache);
  }
  userCache.set(questionHash, answer);
  // 限制每个用户的缓存大小（最多1000条）
  if (userCache.size > 1000) {
    const entries = Array.from(userCache.entries());
    entries.slice(0, entries.length - 1000).forEach(([key]) => userCache!.delete(key));
  }
}

/**
 * @deprecated 此路由已废弃
 * AI 调用现在由前端直接调用 ai-service，不再经过 Next.js
 * 保留此路由仅为向后兼容，返回错误提示
 * 指令版本：0002
 */
export async function POST(req: NextRequest) {
  console.warn("[api/ai/ask] Deprecated route was called. It should no longer be used.");
  
  return NextResponse.json(
    {
      ok: false,
      errorCode: "DEPRECATED_ROUTE",
      message:
        "AI API 已升级，当前端应直接调用 ai-service（callAiDirect），/api/ai/ask 已废弃。",
    },
    { status: 410 } // 410 Gone
  );
}
