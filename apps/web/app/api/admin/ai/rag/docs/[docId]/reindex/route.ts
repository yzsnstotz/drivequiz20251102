// apps/web/app/api/admin/ai/rag/docs/[docId]/reindex/route.ts
/* 功能：触发重建向量（调用 AI-Service /v1/admin/rag/ingest） */
import { NextRequest } from "next/server";
import { aiDb } from "@/lib/aiDb";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, notFound, internalError } from "@/app/api/_lib/errors";
import { logUpdate } from "@/app/api/_lib/operationLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DocRow = {
  id: string;
  title: string;
  url: string | null;
  version: string | null;
};

const getAiRagDocsSelect = () => (aiDb as any).selectFrom("ai_rag_docs");

/**
 * POST /api/admin/ai/rag/docs/:docId/reindex
 * 触发重建向量
 * 调用 AI-Service /v1/admin/rag/ingest，保留 docId + version
 */
export const POST = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ docId: string }> }) => {
    try {
      const { docId: docIdParam } = await params;
      const docId = Number(docIdParam);
      if (isNaN(docId)) return badRequest("Invalid docId parameter");

      // 检查文档是否存在
      const doc = await getAiRagDocsSelect()
        .select(["id", "title", "url", "version"])
        .where("id", "=", docId)
        .executeTakeFirst() as DocRow | undefined;

      if (!doc) {
        return notFound("Document not found");
      }

      // 获取 AI-Service 配置
      const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "";
      const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN || "";

      if (!AI_SERVICE_URL || !AI_SERVICE_TOKEN) {
        return internalError("AI_SERVICE_URL or AI_SERVICE_TOKEN not configured");
      }

      // 调用 AI-Service 的 ingest 端点
      // 注意：content 需要从 URL 获取或由前端提供
      // 如果 URL 存在，AI-Service 应该能够从 URL 获取内容
      // 否则需要前端在调用时提供 content
      const body = await req.json().catch(() => null) as { content?: string } | null;
      const content = body?.content || "";

      // 如果 content 为空且 URL 存在，尝试从 URL 获取（这需要 AI-Service 支持）
      // 当前实现传递 URL，AI-Service 应该能够处理
      const baseUrl = AI_SERVICE_URL.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
      const response = await fetch(`${baseUrl}/v1/admin/rag/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AI_SERVICE_TOKEN}`,
        },
        body: JSON.stringify({
          docId: String(doc.id),
          title: doc.title || "Untitled",
          url: doc.url || "",
          version: doc.version || "v1",
          // 如果前端提供了 content，使用它；否则为空，AI-Service 可能需要从 URL 获取
          content: content,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return internalError(`AI-Service error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // 记录操作日志
      await logUpdate(
        req,
        "ai_rag_docs",
        docId,
        { reindexed: false },
        { reindexed: true },
        `RAG document "${doc.title}" reindexed (version: ${doc.version || "v1"})`
      );

      return success({
        docId: String(doc.id),
        version: doc.version || "v1",
        reindexed: result.ok === true,
        message: result.message || "Reindex triggered",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected server error.";
      return internalError(msg);
    }
  }
);

