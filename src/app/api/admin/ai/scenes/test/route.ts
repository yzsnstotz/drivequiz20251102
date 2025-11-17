// Vercel Serverless Function 配置
export const runtime = "nodejs";
export const maxDuration = 60; // 60秒超时

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { badRequest, internalError, success } from "@/app/api/_lib/errors";
import { callAiServer } from "@/lib/aiClient.server";
import { buildQuestionTranslationInput, buildQuestionPolishInput } from "@/lib/questionPromptBuilder";
import { getCurrentAiProviderConfig } from "@/lib/aiProviderConfig.server";

/**
 * 场景测试接口
 * 
 * 该接口用于场景测试页面，确保测试和实际业务使用完全一致的格式和逻辑
 * 
 * 重要原则：
 * - 不做任何本地缓存，每次调用都发起真实请求
 * - 所有参数必须从请求中完整传递，不使用隐式默认值
 * - 请求体格式必须与现有业务完全一致
 */
export const POST = withAdminAuth(async (req: NextRequest) => {
  const requestId = `scene-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  try {
    console.log(`[Scene Test API] [${requestId}] Request received`);
    const body = await req.json().catch((e) => {
      console.error(`[Scene Test API] [${requestId}] Failed to parse request body:`, e);
      return {};
    });

    /**
     * body 期望结构（从前端传入）：
     * {
     *   sceneKey: string;           // ai_scenes 表中的 scene_key，例如 'question_translation'
     *   rawInput: string;            // 原始题干或文本
     *   options?: string[];         // 选项列表
     *   explanation?: string;        // 解析
     *   sourceLanguage?: string;    // 源语言，如 'zh'
     *   targetLanguage?: string;     // 目标语言，如 'ja'
     *   lang?: string;              // 当前界面/输出语言，保持与现有逻辑一致
     *   model?: string;             // 使用的模型名
     *   provider?: "local" | "render"; // AI provider
     *   questionType?: "single" | "multiple" | "truefalse"; // 题目类型（用于题目类场景）
     * }
     */
    const {
      sceneKey,
      rawInput,
      options,
      explanation,
      sourceLanguage,
      targetLanguage,
      lang,
      model,
      provider,
      questionType,
    } = body;

    // 验证必需字段
    if (!sceneKey || !rawInput) {
      console.error(`[Scene Test API] [${requestId}] Missing required fields`, {
        hasSceneKey: !!sceneKey,
        hasRawInput: !!rawInput,
      });
      return badRequest("sceneKey and rawInput are required");
    }

    // ⚠️ 不要在这里做任何「智能默认值」：
    // sourceLanguage/targetLanguage/lang/model 等都应由前端传入或与现有业务一致。

    let question = rawInput;

    // 这里仅处理"题目类场景"的特殊格式，其余场景保持原样
    if (sceneKey === "question_translation") {
      if (!sourceLanguage || !targetLanguage) {
        console.error(`[Scene Test API] [${requestId}] Missing required fields for question_translation`, {
          hasSourceLanguage: !!sourceLanguage,
          hasTargetLanguage: !!targetLanguage,
        });
        return badRequest("sourceLanguage and targetLanguage are required for question_translation");
      }

      question = buildQuestionTranslationInput({
        stem: rawInput,
        options: options || [],
        explanation: explanation || undefined,
        sourceLanguage,
        targetLanguage,
        questionType: questionType || undefined, // 传递题目类型
      });
    } else if (sceneKey === "question_polish") {
      // 对于润色场景，language 可以从 lang 或 sourceLanguage 获取
      // 但必须确保有值，不能使用隐式默认值
      const language = lang || sourceLanguage;
      if (!language) {
        console.error(`[Scene Test API] [${requestId}] Missing required fields for question_polish`, {
          hasLang: !!lang,
          hasSourceLanguage: !!sourceLanguage,
        });
        return badRequest("language (lang or sourceLanguage) is required for question_polish");
      }

      question = buildQuestionPolishInput({
        stem: rawInput,
        options: options || [],
        explanation: explanation || undefined,
        language,
        questionType: questionType || undefined, // 传递题目类型
      });
    }
    // 其他场景保持原样，直接使用 rawInput

    // 获取当前配置的 provider 和 model（如果未在请求中指定）
    let finalProvider: "local" | "render" = provider;
    let finalModel: string | undefined = model;

    if (!finalProvider || !finalModel) {
      const providerConfig = await getCurrentAiProviderConfig();
      finalProvider = finalProvider || providerConfig.provider;
      finalModel = finalModel || providerConfig.model;
    }

    // 构造发给 /v1/ask 的完整请求体
    // ⚠️ 请保持与 aiClient.server 现有逻辑一致
    const aiRequestBody = {
      provider: finalProvider,
      question,
      locale: lang || targetLanguage || sourceLanguage || "zh", // 保持与现有逻辑一致
      scene: sceneKey,
      sourceLanguage: sourceLanguage || undefined,
      targetLanguage: targetLanguage || undefined,
      model: finalModel,
    };

    console.log(`[Scene Test API] [${requestId}] Calling AI service:`, {
      provider: aiRequestBody.provider,
      scene: aiRequestBody.scene,
      sourceLanguage: aiRequestBody.sourceLanguage,
      targetLanguage: aiRequestBody.targetLanguage,
      locale: aiRequestBody.locale,
      model: aiRequestBody.model,
      questionLength: question.length,
    });

    // 直接复用现有的服务端 AI 客户端
    // ⚠️ 不做任何缓存，每次调用都发起真实请求
    const aiResponse = await callAiServer(aiRequestBody, {
      timeoutMs: 120000, // 120秒超时
    });

    console.log(`[Scene Test API] [${requestId}] AI service response:`, {
      ok: aiResponse.ok,
      hasData: !!aiResponse.data,
      hasAnswer: !!aiResponse.data?.answer,
    });

    return success({
      ok: true,
      request: {
        // 返回最终发给 AI 的 payload（方便前端展示和调试）
        // 注意：隐藏敏感字段如 token
        provider: aiRequestBody.provider,
        question: aiRequestBody.question,
        locale: aiRequestBody.locale,
        scene: aiRequestBody.scene,
        sourceLanguage: aiRequestBody.sourceLanguage,
        targetLanguage: aiRequestBody.targetLanguage,
        model: aiRequestBody.model,
      },
      response: {
        ok: aiResponse.ok,
        data: aiResponse.data,
        message: aiResponse.message,
        errorCode: aiResponse.errorCode,
      },
    });
  } catch (err: any) {
    console.error(`[Scene Test API] [${requestId}] Error:`, err?.message, err?.stack);
    // 这里不要吞掉错误，尽量返回可调试的信息，但避免泄露敏感内容
    return internalError(err?.message || "Unknown error");
  }
});

