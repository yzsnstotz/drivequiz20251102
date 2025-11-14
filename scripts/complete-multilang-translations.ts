// 补全所有问题的多语言翻译
// 遍历 questions_auto_tag.json，确保每个对象的 content 都有 zh、en 和 ja
// 如果只有其中一种，则基于这种语言翻译到其他两种语言

import * as fs from "fs/promises";
import * as path from "path";
import * as dotenv from "dotenv";

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const INPUT_FILE = path.resolve(__dirname, "../src/data/questions/zh/questions_auto_tag.json");
const BATCH_SIZE = 5; // 每批处理的问题数量
const DELAY_BETWEEN_BATCHES = 3000; // 批次之间的延迟（毫秒）
const DELAY_BETWEEN_QUESTIONS = 1000; // 问题之间的延迟（毫秒）

interface Question {
  id: string;
  type: string;
  content: string | {
    zh?: string;
    en?: string;
    ja?: string;
  };
  correctAnswer: string;
  category?: string;
  hash?: string;
  license_tags?: string[];
  stage_tag?: string;
  topic_tags?: string[];
  image?: string;
  explanation?: string | {
    zh?: string;
    en?: string;
    ja?: string;
  };
}

// 获取主站URL（用于调用API）
function getMainAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

// 检测文本语言
function detectLanguage(text: string): "zh" | "en" | "ja" {
  if (!text || text.trim().length === 0) return "zh";
  
  // 检测日文（平假名、片假名、汉字混合）
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  if (japaneseRegex.test(text)) {
    const japaneseChars = text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || [];
    if (japaneseChars.length > text.length * 0.3) {
      return "ja";
    }
  }

  // 检测英文（主要是英文字母）
  const englishRegex = /^[a-zA-Z\s.,!?'"-]+$/;
  if (englishRegex.test(text) && text.length > 0) {
    const englishChars = text.match(/[a-zA-Z]/g) || [];
    if (englishChars.length > text.length * 0.5) {
      return "en";
    }
  }

  // 检测中文（中文字符）
  const chineseRegex = /[\u4E00-\u9FAF]/;
  if (chineseRegex.test(text)) {
    return "zh";
  }

  // 默认返回中文
  return "zh";
}

// 调用AI服务翻译文本
async function translateWithAI(text: string, sourceLang: "zh" | "en" | "ja", targetLang: "zh" | "en" | "ja"): Promise<string> {
  const mainAppUrl = getMainAppUrl();
  const url = `${mainAppUrl}/api/ai/ask`;
  
  const langNames: Record<string, string> = {
    zh: "中文",
    en: "英语",
    ja: "日语"
  };
  
  const prompt = `请将以下${langNames[sourceLang]}文本翻译成${langNames[targetLang]}，只返回翻译结果，不要添加任何解释、标记或代码块：

${text}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: prompt,
        locale: targetLang === "en" ? "en-US" : targetLang === "ja" ? "ja-JP" : "zh-CN",
        scene: "question_translation",
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI服务返回错误: ${response.status} ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    
    if (!data.ok || !data.data?.answer) {
      throw new Error(`AI服务返回无效响应: ${JSON.stringify(data).substring(0, 200)}`);
    }

    // 清理翻译结果
    let translated = data.data.answer.trim();
    // 移除可能的代码块标记
    translated = translated.replace(/```[\w]*\n?/g, "").replace(/```/g, "").trim();
    // 移除可能的引号
    if ((translated.startsWith('"') && translated.endsWith('"')) || 
        (translated.startsWith("'") && translated.endsWith("'"))) {
      translated = translated.slice(1, -1);
    }
    // 移除可能的标记
    translated = translated.replace(/^\[EN\]\s*/i, "").replace(/^\[JA\]\s*/i, "").trim();

    return translated;
  } catch (error: any) {
    console.error(`翻译失败 (${sourceLang} -> ${targetLang}):`, error.message);
    throw error;
  }
}

// 检查是否需要补全翻译
function needsTranslation(q: Question): boolean {
  if (typeof q.content === "string") {
    return true;
  }
  
  const content = q.content as { zh?: string; en?: string; ja?: string };
  
  // 检查是否有占位符或缺失的语言
  const hasZh = content.zh && !content.zh.startsWith("[ZH]");
  const hasEn = content.en && !content.en.startsWith("[EN]");
  const hasJa = content.ja && !content.ja.startsWith("[JA]");
  
  return !hasZh || !hasEn || !hasJa;
}

// 获取可用的源语言文本
function getSourceText(content: { zh?: string; en?: string; ja?: string }): { text: string; lang: "zh" | "en" | "ja" } | null {
  // 优先使用中文
  if (content.zh && !content.zh.startsWith("[ZH]")) {
    return { text: content.zh, lang: "zh" };
  }
  // 其次使用英文
  if (content.en && !content.en.startsWith("[EN]")) {
    return { text: content.en, lang: "en" };
  }
  // 最后使用日文
  if (content.ja && !content.ja.startsWith("[JA]")) {
    return { text: content.ja, lang: "ja" };
  }
  return null;
}

// 补全单个问题的翻译
async function completeQuestionTranslation(q: Question): Promise<Question> {
  // 确保 content 是对象格式
  let content: { zh?: string; en?: string; ja?: string };
  
  if (typeof q.content === "string") {
    // 检测字符串的语言
    const detectedLang = detectLanguage(q.content);
    content = { [detectedLang]: q.content };
  } else {
    content = { ...q.content };
  }

  // 获取源文本
  const source = getSourceText(content);
  if (!source) {
    console.error(`  问题 ${q.id}: 无法找到有效的源文本`);
    return q;
  }

  const { text: sourceText, lang: sourceLang } = source;

  // 检查需要翻译的语言
  const needsZh = !content.zh || content.zh.startsWith("[ZH]");
  const needsEn = !content.en || content.en.startsWith("[EN]");
  const needsJa = !content.ja || content.ja.startsWith("[JA]");

  console.log(`  处理问题 ${q.id} (源语言: ${sourceLang})...`);

  try {
    // 翻译缺失的语言
    const translations: Promise<string>[] = [];
    const targets: Array<{ lang: "zh" | "en" | "ja"; index: number }> = [];

    if (needsZh && sourceLang !== "zh") {
      targets.push({ lang: "zh", index: translations.length });
      translations.push(translateWithAI(sourceText, sourceLang, "zh"));
    }

    if (needsEn && sourceLang !== "en") {
      targets.push({ lang: "en", index: translations.length });
      translations.push(translateWithAI(sourceText, sourceLang, "en"));
    }

    if (needsJa && sourceLang !== "ja") {
      targets.push({ lang: "ja", index: translations.length });
      translations.push(translateWithAI(sourceText, sourceLang, "ja"));
    }

    // 等待所有翻译完成
    const results = await Promise.all(translations);

    // 更新 content
    targets.forEach((target, i) => {
      content[target.lang] = results[i];
    });

    // 确保所有语言都存在
    if (!content.zh) content.zh = sourceLang === "zh" ? sourceText : "";
    if (!content.en) content.en = sourceLang === "en" ? sourceText : "";
    if (!content.ja) content.ja = sourceLang === "ja" ? sourceText : "";

    // 处理 explanation（如果存在）
    let explanation: { zh?: string; en?: string; ja?: string } | undefined;
    if (q.explanation) {
      let explContent: { zh?: string; en?: string; ja?: string };
      
      if (typeof q.explanation === "string") {
        const detectedLang = detectLanguage(q.explanation);
        explContent = { [detectedLang]: q.explanation };
      } else {
        explContent = { ...q.explanation };
      }

      const explSource = getSourceText(explContent);
      if (explSource) {
        const { text: explSourceText, lang: explSourceLang } = explSource;
        
        const explNeedsZh = !explContent.zh || explContent.zh.startsWith("[ZH]");
        const explNeedsEn = !explContent.en || explContent.en.startsWith("[EN]");
        const explNeedsJa = !explContent.ja || explContent.ja.startsWith("[JA]");

        const explTranslations: Promise<string>[] = [];
        const explTargets: Array<{ lang: "zh" | "en" | "ja"; index: number }> = [];

        if (explNeedsZh && explSourceLang !== "zh") {
          explTargets.push({ lang: "zh", index: explTranslations.length });
          explTranslations.push(translateWithAI(explSourceText, explSourceLang, "zh"));
        }

        if (explNeedsEn && explSourceLang !== "en") {
          explTargets.push({ lang: "en", index: explTranslations.length });
          explTranslations.push(translateWithAI(explSourceText, explSourceLang, "en"));
        }

        if (explNeedsJa && explSourceLang !== "ja") {
          explTargets.push({ lang: "ja", index: explTranslations.length });
          explTranslations.push(translateWithAI(explSourceText, explSourceLang, "ja"));
        }

        if (explTranslations.length > 0) {
          const explResults = await Promise.all(explTranslations);
          explTargets.forEach((target, i) => {
            explContent[target.lang] = explResults[i];
          });
        }

        // 确保所有语言都存在
        if (!explContent.zh) explContent.zh = explSourceLang === "zh" ? explSourceText : "";
        if (!explContent.en) explContent.en = explSourceLang === "en" ? explSourceText : "";
        if (!explContent.ja) explContent.ja = explSourceLang === "ja" ? explSourceText : "";

        explanation = explContent;
      }
    }

    // 延迟以避免API限流
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_QUESTIONS));

    return {
      ...q,
      content,
      ...(explanation && { explanation }),
    };
  } catch (error: any) {
    console.error(`  处理问题 ${q.id} 失败:`, error.message);
    return q;
  }
}

async function main() {
  console.log("开始补全多语言翻译...");
  console.log(`输入文件: ${INPUT_FILE}`);
  console.log(`批次大小: ${BATCH_SIZE}`);
  console.log(`主站URL: ${getMainAppUrl()}\n`);

  // 读取文件
  console.log("读取文件...");
  const content = await fs.readFile(INPUT_FILE, "utf-8");
  const questions: Question[] = JSON.parse(content);
  console.log(`读取到 ${questions.length} 个问题\n`);

  // 找出需要翻译的问题
  const needsTranslationList = questions.filter(needsTranslation);
  console.log(`需要补全翻译的问题: ${needsTranslationList.length}/${questions.length}\n`);

  if (needsTranslationList.length === 0) {
    console.log("所有问题都已完整翻译！");
    return;
  }

  // 分批处理
  let processed = 0;
  let translated = 0;
  let failed = 0;

  for (let i = 0; i < needsTranslationList.length; i += BATCH_SIZE) {
    const batch = needsTranslationList.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(needsTranslationList.length / BATCH_SIZE);

    console.log(`\n处理批次 ${batchNum}/${totalBatches} (问题 ${i + 1}-${Math.min(i + BATCH_SIZE, needsTranslationList.length)})`);

    // 处理批次中的每个问题
    for (const q of batch) {
      const index = questions.findIndex(q2 => q2.id === q.id);
      if (index === -1) continue;

      try {
        const completedQ = await completeQuestionTranslation(q);
        questions[index] = completedQ;
        processed++;
        
        if (!needsTranslation(completedQ)) {
          translated++;
        } else {
          failed++;
        }

        // 每处理5个问题保存一次
        if (processed % 5 === 0) {
          console.log(`  保存进度... (已处理 ${processed}/${needsTranslationList.length})`);
          await fs.writeFile(INPUT_FILE, JSON.stringify(questions, null, 2), "utf-8");
        }
      } catch (error: any) {
        console.error(`  处理问题 ${q.id} 时出错:`, error.message);
        failed++;
      }
    }

    // 批次之间的延迟
    if (i + BATCH_SIZE < needsTranslationList.length) {
      console.log(`  等待 ${DELAY_BETWEEN_BATCHES}ms 后继续下一批次...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  // 最终保存
  console.log("\n保存最终结果...");
  await fs.writeFile(INPUT_FILE, JSON.stringify(questions, null, 2), "utf-8");

  // 统计结果
  console.log("\n翻译完成！");
  console.log(`总问题数: ${questions.length}`);
  console.log(`已处理: ${processed}`);
  console.log(`成功翻译: ${translated}`);
  console.log(`失败/需要重试: ${failed}`);

  // 重新统计翻译状态
  const finalNeedsTranslation = questions.filter(needsTranslation).length;
  const finalTranslated = questions.length - finalNeedsTranslation;
  console.log(`\n最终状态:`);
  console.log(`  已完整翻译: ${finalTranslated}/${questions.length} (${((finalTranslated / questions.length) * 100).toFixed(2)}%)`);
  console.log(`  待补全: ${finalNeedsTranslation}/${questions.length} (${((finalNeedsTranslation / questions.length) * 100).toFixed(2)}%)`);
}

main().catch((error) => {
  console.error("处理过程中发生错误:", error);
  process.exit(1);
});




