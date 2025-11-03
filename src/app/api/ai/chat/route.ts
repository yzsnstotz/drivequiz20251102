import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/** ===============================
 * 环境变量
 * =============================== */
const USER_JWT_SECRET = process.env.USER_JWT_SECRET; // HMAC 密钥（用户端 JWT 校验）
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // OpenAI Key
const AI_MODEL = process.env.AI_MODEL ?? "gpt-4o-mini"; // 可切换模型
const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 30000);

/** ===============================
 * 统一响应工具
 * =============================== */
type Ok<T> = { ok: true; data: T };
type Err = { ok: false; errorCode: string; message: string };

function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<Ok<T>>({ ok: true, data }, init);
}
function badRequest(errorCode: string, message: string, init?: ResponseInit) {
  return NextResponse.json<Err>({ ok: false, errorCode, message }, init ?? { status: 400 });
}
function unauthorized(errorCode: string, message: string) {
  return NextResponse.json<Err>({ ok: false, errorCode, message }, { status: 401 });
}
function internalError(message = "Internal server error", code = "INTERNAL_ERROR") {
  return NextResponse.json<Err>({ ok: false, errorCode: code, message }, { status: 500 });
}

/** ===============================
 * 请求/响应类型
 * =============================== */
interface ChatRequestBody {
  question?: string;
  meta?: {
    client?: string;
    locale?: string;
    tz?: string;
    pageId?: string;
    userId?: string;
    sessionId?: string;
  };
}
interface ChatAnswer {
  answer: string;
}

/** ===============================
 * 安全审查（可扩展）
 * - 返回不通过时给出明确的错误码
 * =============================== */
function checkSafety(input: string): { pass: true } | { pass: false; code: string; reason: string } {
  const text = (input || "").toLowerCase();

  // 示例规则（请按业务补充/替换）
  const hardBlocks = [
    /自杀|轻生|suicide|kill myself/,
    /制造爆炸物|bomb making|homemade explosive/,
    /毒品制作|cook meth|制造毒品/,
    /信用卡盗刷|刷卡器|skimmer/,
  ];

  for (const r of hardBlocks) {
    if (r.test(text)) {
      return {
        pass: false,
        code: "SAFETY_BLOCKED",
        reason: "内容涉及受限或高危主题，已被拦截。",
      };
    }
  }

  return { pass: true };
}

/** ===============================
 * 用户 JWT 校验
 * - 使用 HMAC（HS256/HS512）验证
 * =============================== */
async function verifyUserJwt(authorization?: string) {
  if (!authorization?.startsWith("Bearer ")) return { valid: false, reason: "MISSING_BEARER" as const };
  if (!USER_JWT_SECRET) return { valid: false, reason: "SERVER_MISCONFIG" as const, detail: "USER_JWT_SECRET not set" };

  const token = authorization.slice("Bearer ".length).trim();
  try {
    const secret = new TextEncoder().encode(USER_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret); // 默认允许 HS256
    return { valid: true as const, payload };
  } catch (e) {
    return { valid: false as const, reason: "INVALID_TOKEN" as const };
  }
}

/** ===============================
 * OpenAI 调用
 * - 如接入自建 AI-Service，可在此改为内部 fetch，并附带 SERVICE_TOKEN
 * =============================== */
async function callOpenAI(question: string, meta?: ChatRequestBody["meta"]): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);

  try {
    // 官方 SDK 也可用；此处使用 HTTP 以减少依赖
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are ZALEM.app's AI assistant for Japan driving theory learning. Answer concisely in Chinese unless asked otherwise.",
          },
          {
            role: "user",
            content: question,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!resp.ok) {
      const detail = await safeJson(resp).catch(() => null);
      throw new Error(`OpenAI HTTP ${resp.status}: ${JSON.stringify(detail)}`);
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const answer = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return answer;
  } finally {
    clearTimeout(t);
  }
}

async function safeJson(r: Response) {
  try {
    return await r.json();
  } catch {
    return null;
  }
}

/** ===============================
 * 路由实现
 * =============================== */
export async function POST(req: NextRequest) {
  // 1) 用户 JWT 校验
  const auth = req.headers.get("authorization") ?? undefined;
  const jwtRes = await verifyUserJwt(auth);
  if (!jwtRes.valid) {
    if (jwtRes.reason === "SERVER_MISCONFIG") {
      return internalError("Server misconfigured: USER_JWT_SECRET missing", "SERVER_MISCONFIG");
    }
    if (jwtRes.reason === "MISSING_BEARER") {
      return unauthorized("NO_AUTH", "缺少认证信息（Authorization: Bearer ...）");
    }
    return unauthorized("INVALID_TOKEN", "无效或过期的认证信息");
  }

  // 2) 解析请求体
  let body: ChatRequestBody | null = null;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return badRequest("INVALID_JSON", "请求体必须为 JSON");
  }

  const question = body?.question?.trim() ?? "";
  if (!question) {
    return badRequest("VALIDATION_FAILED", "question 不能为空");
  }

  // 3) 安全审查（禁答直返）
  const safety = checkSafety(question);
  if (!safety.pass) {
    return NextResponse.json<Err>(
      {
        ok: false,
        errorCode: safety.code,
        message: safety.reason,
      },
      { status: 400 },
    );
  }

  // 4) 调用模型（或内部 AI-Service）
  try {
    const answer = await callOpenAI(question, body?.meta);
    return ok<ChatAnswer>({ answer });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return internalError(`AI 调用失败：${msg}`, "AI_CALL_FAILED");
  }
}

/** GET 可用于健康检查/接口探测（可选） */
export async function GET() {
  return ok({ service: "ai-chat", model: AI_MODEL, ts: new Date().toISOString() });
}
