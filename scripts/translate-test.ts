// 测试翻译脚本 - 先翻译少量问题验证流程

import * as fs from "fs/promises";
import * as path from "path";
import * as dotenv from "dotenv";

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const INPUT_FILE = path.resolve(__dirname, "../src/data/questions/zh/questions_auto_tag.json");
const TEST_COUNT = 5; // 测试翻译的问题数量

interface Question {
  id: string;
  type: string;
  content: string | {
    zh: string;
    en: string;
    ja: string;
  };
  correctAnswer: string;
  category?: string;
  hash?: string;
  license_tags?: string[];
  stage_tag?: string;
  topic_tags?: string[];
  image?: string;
  explanation?: string | {
    zh: string;
    en: string;
    ja: string;
  };
}

// 获取主站URL
function getMainAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

// 调用AI服务翻译文本
async function translateWithAI(text: string, targetLang: "en" | "ja"): Promise<string> {
  const mainAppUrl = getMainAppUrl();
  const url = `${mainAppUrl}/api/ai/ask`;
  
  const prompt = `请将以下中文文本翻译成${targetLang === "en" ? "英语" : "日语"}，只返回翻译结果，不要添加任何解释、标记或代码块：

${text}`;

  console.log(`    调用AI服务翻译到 ${targetLang}...`);
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: prompt,
        locale: targetLang === "en" ? "en-US" : "ja-JP",
        scene: "question_translation",
        sourceLanguage: "zh",
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
    translated = translated.replace(/```[\w]*\n?/g, "").replace(/```/g, "").trim();
    if ((translated.startsWith('"') && translated.endsWith('"')) || 
        (translated.startsWith("'") && translated.endsWith("'"))) {
      translated = translated.slice(1, -1);
    }
    translated = translated.replace(/^\[EN\]\s*/i, "").replace(/^\[JA\]\s*/i, "").trim();

    return translated;
  } catch (error: any) {
    console.error(`    翻译失败 (${targetLang}):`, error.message);
    throw error;
  }
}

// 检查是否需要翻译
function needsTranslation(q: Question): boolean {
  if (typeof q.content === "string") {
    return true;
  }
  
  const content = q.content as { zh: string; en: string; ja: string };
  return (
    !content.en || 
    content.en.startsWith("[EN]") || 
    !content.ja || 
    content.ja.startsWith("[JA]")
  );
}

// 确保多语言格式
function ensureMultilangFormat(q: Question): Question {
  let zhContent: string;
  let zhExplanation: string | undefined;

  if (typeof q.content === "string") {
    zhContent = q.content;
  } else {
    zhContent = q.content.zh;
  }

  if (typeof q.explanation === "string") {
    zhExplanation = q.explanation;
  } else if (q.explanation) {
    zhExplanation = q.explanation.zh;
  }

  const content = typeof q.content === "string" 
    ? { zh: q.content, en: `[EN] ${q.content}`, ja: `[JA] ${q.content}` }
    : q.content;

  let explanation: { zh: string; en: string; ja: string } | undefined;
  if (zhExplanation) {
    if (typeof q.explanation === "string") {
      explanation = { zh: zhExplanation, en: `[EN] ${zhExplanation}`, ja: `[JA] ${zhExplanation}` };
    } else if (q.explanation) {
      explanation = q.explanation;
    }
  }

  return {
    ...q,
    content,
    ...(explanation && { explanation }),
  };
}

// 翻译单个问题
async function translateQuestion(q: Question): Promise<Question> {
  const formattedQ = ensureMultilangFormat(q);
  
  if (!needsTranslation(formattedQ)) {
    return formattedQ;
  }

  const content = formattedQ.content as { zh: string; en: string; ja: string };
  const zhContent = content.zh;
  const zhExplanation = formattedQ.explanation 
    ? (typeof formattedQ.explanation === "string" 
        ? formattedQ.explanation 
        : formattedQ.explanation.zh)
    : undefined;

  console.log(`  翻译问题 ${q.id}: ${zhContent.substring(0, 50)}...`);

  try {
    const [enContent, jaContent] = await Promise.all([
      translateWithAI(zhContent, "en"),
      translateWithAI(zhContent, "ja"),
    ]);

    let enExplanation: string | undefined;
    let jaExplanation: string | undefined;
    if (zhExplanation) {
      [enExplanation, jaExplanation] = await Promise.all([
        translateWithAI(zhExplanation, "en"),
        translateWithAI(zhExplanation, "ja"),
      ]);
    }

    const updated: Question = {
      ...formattedQ,
      content: {
        zh: zhContent,
        en: enContent,
        ja: jaContent,
      },
    };

    if (zhExplanation) {
      updated.explanation = {
        zh: zhExplanation,
        en: enExplanation!,
        ja: jaExplanation!,
      };
    }

    return updated;
  } catch (error: any) {
    console.error(`  翻译问题 ${q.id} 失败:`, error.message);
    return formattedQ;
  }
}

async function main() {
  console.log("测试翻译脚本");
  console.log(`输入文件: ${INPUT_FILE}`);
  console.log(`测试数量: ${TEST_COUNT}`);
  console.log(`主站URL: ${getMainAppUrl()}\n`);

  // 读取文件
  console.log("读取文件...");
  const content = await fs.readFile(INPUT_FILE, "utf-8");
  const questions: Question[] = JSON.parse(content);
  console.log(`读取到 ${questions.length} 个问题\n`);

  // 找出需要翻译的问题
  const needsTranslationList = questions.filter(needsTranslation);
  console.log(`需要翻译的问题: ${needsTranslationList.length}/${questions.length}`);
  console.log(`已翻译的问题: ${questions.length - needsTranslationList.length}/${questions.length}\n`);

  if (needsTranslationList.length === 0) {
    console.log("所有问题都已翻译完成！");
    return;
  }

  // 只翻译前几个问题进行测试
  const testList = needsTranslationList.slice(0, TEST_COUNT);
  console.log(`测试翻译前 ${testList.length} 个问题...\n`);

  let translated = 0;
  let failed = 0;

  for (const q of testList) {
    const index = questions.findIndex(q2 => q2.id === q.id);
    if (index === -1) continue;

    try {
      const translatedQ = await translateQuestion(q);
      questions[index] = translatedQ;
      
      if (!needsTranslation(translatedQ)) {
        translated++;
        console.log(`  ✓ 问题 ${q.id} 翻译成功\n`);
      } else {
        failed++;
        console.log(`  ✗ 问题 ${q.id} 翻译失败\n`);
      }
    } catch (error: any) {
      console.error(`  处理问题 ${q.id} 时出错:`, error.message);
      failed++;
    }
  }

  // 保存结果
  console.log("\n保存测试结果...");
  await fs.writeFile(INPUT_FILE, JSON.stringify(questions, null, 2), "utf-8");

  console.log("\n测试完成！");
  console.log(`成功翻译: ${translated}`);
  console.log(`失败: ${failed}`);
  console.log("\n如果测试成功，可以运行 scripts/translate-all-remaining.ts 来翻译所有剩余的问题");
}

main().catch((error) => {
  console.error("处理过程中发生错误:", error);
  process.exit(1);
});




