// Vercel Serverless Function 配置
export const runtime = "nodejs";
export const maxDuration = 60; // 60秒超时（Vercel Pro计划最多300秒，这里设置为60秒以支持重试）

import { withAdminAuth, getAdminInfo } from "@/app/api/_lib/withAdminAuth";
import { badRequest, internalError, success } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";
import { translateWithPolish } from "../_lib/batchProcessUtils";

export const POST = withAdminAuth(async (req: Request) => {
  const requestId = `api-translate-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  console.log(`[API Translate] [${requestId}] ========== TRANSLATE API CALLED ==========`);
  console.log(`[API Translate] [${requestId}] Request URL: ${req.url}`);
  console.log(`[API Translate] [${requestId}] Request method: ${req.method}`);
  try {
    console.log(`[API Translate] [${requestId}] Request received`);
    const body = await req.json().catch((e) => {
      console.error(`[API Translate] [${requestId}] Failed to parse request body:`, e);
      return {};
    });
    const { questionId, contentHash, from, to } = body || {};
    console.log(`[API Translate] [${requestId}] Body parsed:`, { questionId, contentHash, from, to });
    
    if ((!questionId && !contentHash) || !from || !to) {
      console.error(`[API Translate] [${requestId}] Missing required fields`);
      return badRequest("questionId/contentHash, from, to are required");
    }
    
    // 支持 to 为字符串或字符串数组
    const targetLanguages = Array.isArray(to) ? to : [to];
    
    // 获取题目内容
    let question: any = null;
    if (contentHash) {
      question = await db
        .selectFrom("questions")
        .select(["id", "content_hash", "content", "options", "explanation"])
        .where("content_hash", "=", contentHash)
        .executeTakeFirst();
    } else if (questionId) {
      question = await db
        .selectFrom("questions")
        .select(["id", "content_hash", "content", "options", "explanation"])
        .where("id", "=", questionId)
        .executeTakeFirst();
    }

    if (!question) {
      return badRequest("Question not found");
    }

    // 获取源语言内容
    let content: string = "";
    let options: string[] | undefined = undefined;
    let explanation: string | undefined = undefined;

    if (from.toLowerCase().startsWith("zh")) {
      // 从 questions 表获取中文内容
      if (typeof question.content === "object" && question.content !== null) {
        content = question.content.zh || "";
      } else {
        content = String(question.content || "");
      }
      options = Array.isArray(question.options) ? question.options : undefined;
      if (question.explanation) {
        if (typeof question.explanation === "object" && question.explanation !== null) {
          explanation = question.explanation.zh || undefined;
        } else {
          explanation = String(question.explanation || "");
        }
      }
    } else {
      // 从 questions.content JSONB 字段获取翻译内容
      if (typeof question.content === "object" && question.content !== null) {
        const contentObj = question.content as { [key: string]: string | undefined };
        content = contentObj[from] || "";
      } else {
        return badRequest(`Source language translation not found for locale: ${from}`);
      }
      
      // 从 questions.explanation JSONB 字段获取解析
      if (question.explanation && typeof question.explanation === "object" && question.explanation !== null) {
        const expObj = question.explanation as { [key: string]: string | undefined };
        explanation = expObj[from] || undefined;
      }
    }

    if (!content) {
      return badRequest("Source content is empty");
    }

    // 获取管理员 token，用于传递给 AI API 调用以跳过配额限制
    let adminToken: string | undefined = undefined;
    try {
      const adminInfo = await getAdminInfo(req as any);
      if (adminInfo) {
        adminToken = adminInfo.token;
      }
    } catch (e) {
      console.warn(`[API Translate] [${requestId}] Failed to get admin token:`, (e as Error).message);
    }

    // 为每个目标语言执行翻译
    const results: any[] = [];
    console.log(`[API Translate] [${requestId}] Starting translation for ${targetLanguages.length} language(s):`, targetLanguages);
    for (const targetLang of targetLanguages) {
      console.log(`[API Translate] [${requestId}] ========== Translating to ${targetLang} ==========`);
      try {
        console.log(`[API Translate] [${requestId}] Calling translateWithPolish`, {
          contentLength: content?.length || 0,
          hasOptions: !!options,
          hasExplanation: !!explanation,
          from,
          to: targetLang,
        });
        const result = await translateWithPolish({
          source: {
            content,
            options,
            explanation,
          },
          from,
          to: targetLang,
          adminToken,
        });
        console.log(`[API Translate] [${requestId}] translateWithPolish completed`, {
          contentLength: result.content?.length || 0,
          hasOptions: !!result.options,
          hasExplanation: !!result.explanation,
        });

        // 保存翻译结果到 questions.content JSONB 字段
        console.log(`[API Translate] [${requestId}] Saving translation to ${targetLang}`, {
          questionId: question.id,
          contentHash: question.content_hash,
          contentLength: result.content?.length || 0,
          hasOptions: !!result.options,
          hasExplanation: !!result.explanation,
        });
        
        // 获取当前题目内容
        const currentQuestion = await db
          .selectFrom("questions")
          .select(["content", "explanation"])
          .where("id", "=", question.id)
          .executeTakeFirst();

        if (!currentQuestion) {
          throw new Error("Question not found");
        }

        // 更新 content JSONB 对象，添加目标语言
        let updatedContent: any;
        if (typeof currentQuestion.content === "object" && currentQuestion.content !== null) {
          updatedContent = { ...currentQuestion.content, [targetLang]: result.content };
        } else {
          // 如果原本是字符串，转换为 JSONB 对象
          const zhContent = typeof currentQuestion.content === "string" 
            ? currentQuestion.content 
            : (currentQuestion.content?.zh || "");
          updatedContent = { zh: zhContent, [targetLang]: result.content };
        }

        // 更新 explanation JSONB 对象，添加目标语言
        let updatedExplanation: any = null;
        if (result.explanation) {
          const explanationStr = typeof result.explanation === "string" 
            ? result.explanation 
            : String(result.explanation);
          
          if (currentQuestion.explanation && typeof currentQuestion.explanation === "object" && currentQuestion.explanation !== null) {
            updatedExplanation = { ...currentQuestion.explanation, [targetLang]: explanationStr };
          } else {
            const zhExplanation = typeof currentQuestion.explanation === "string"
              ? currentQuestion.explanation
              : (currentQuestion.explanation?.zh || "");
            updatedExplanation = zhExplanation 
              ? { zh: zhExplanation, [targetLang]: explanationStr }
              : { [targetLang]: explanationStr };
          }
        } else if (currentQuestion.explanation) {
          updatedExplanation = currentQuestion.explanation;
        }

        // 更新题目
        const updateResult = await db
          .updateTable("questions")
          .set({
            content: updatedContent as any,
            explanation: updatedExplanation as any,
            updated_at: new Date(),
          })
          .where("id", "=", question.id)
          .execute();
        
        console.log(`[API Translate] [${requestId}] Translation saved successfully`, {
          rowsAffected: updateResult.length || 0,
          questionId: question.id,
        });

        // 等待一小段时间确保数据库操作完成
        await new Promise(resolve => setTimeout(resolve, 100));

        // 验证保存是否成功
        const saved = await db
          .selectFrom("questions")
          .select(["id", "content", "explanation", "updated_at"])
          .where("id", "=", question.id)
          .executeTakeFirst();
        
        console.log(`[API Translate] [${requestId}] Verification query result:`, {
          found: !!saved,
          id: saved?.id,
          hasContent: !!saved?.content,
          hasExplanation: !!saved?.explanation,
          updatedAt: saved?.updated_at,
        });
        
        if (!saved) {
          throw new Error(`Failed to save translation: question not found (id: ${question.id})`);
        }
        
        // 验证 content JSONB 中是否包含目标语言
        if (typeof saved.content === "object" && saved.content !== null) {
          const contentObj = saved.content as { [key: string]: string | undefined };
          const targetContent = contentObj[targetLang];
          if (!targetContent || targetContent.trim().length === 0) {
            throw new Error(`Failed to save translation: content for ${targetLang} is empty (id: ${saved.id})`);
          }
          console.log(`[API Translate] [${requestId}] Translation to ${targetLang} saved and verified`, {
            questionId: saved.id,
            locale: targetLang,
            contentLength: targetContent.length,
            contentPreview: targetContent.substring(0, 50) + "...",
          });
        } else {
          throw new Error(`Failed to save translation: content is not a JSONB object (id: ${saved.id})`);
        }
        
        results.push({ locale: targetLang, success: true });
        console.log(`[API Translate] [${requestId}] Translation to ${targetLang} completed`);
      } catch (error: any) {
        console.error(`[API Translate] [${requestId}] Translation to ${targetLang} failed:`, error.message);
        results.push({ locale: targetLang, success: false, error: error.message });
      }
    }
    
    console.log(`[API Translate] [${requestId}] Request completed successfully`);
    return success({ results, ok: true });
  } catch (e: any) {
    console.error(`[API Translate] [${requestId}] Error:`, e?.message, e?.stack);
    return internalError(e?.message || "Translate failed");
  }
});


