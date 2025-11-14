// 批量翻译剩余的问题
// 使用项目的AI服务进行翻译

import * as fs from "fs/promises";
import * as path from "path";

const INPUT_FILE = path.resolve(__dirname, "../src/data/questions/zh/questions_auto_tag.json");
const BATCH_SIZE = 10; // 每批处理的问题数量
const DELAY_BETWEEN_BATCHES = 2000; // 批次之间的延迟（毫秒）
const DELAY_BETWEEN_QUESTIONS = 500; // 问题之间的延迟（毫秒）

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

// 获取AI服务URL
function getAiServiceUrl(): string {
  // 优先使用环境变量
  if (process.env.AI_SERVICE_URL) {
    return process.env.AI_SERVICE_URL;
  }
  // 默认使用本地服务
  return "http://localhost:3001";
}

// 调用AI服务翻译文本
async function translateWithAI(text: string, targetLang: "en" | "ja"): Promise<string> {
  const aiServiceUrl = getAiServiceUrl();
  const url = `${aiServiceUrl}/api/ai/ask`;
  
  const prompt = `请将以下中文文本翻译成${targetLang === "en" ? "英语" : "日语"}，只返回翻译结果，不要添加任何解释或标记：

${text}`;

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

    // 清理翻译结果（移除可能的标记）
    let translated = data.data.answer.trim();
    // 移除可能的代码块标记
    translated = translated.replace(/```[\w]*\n?/g, "").replace(/```/g, "").trim();
    // 移除可能的引号
    if ((translated.startsWith('"') && translated.endsWith('"')) || 
        (translated.startsWith("'") && translated.endsWith("'"))) {
      translated = translated.slice(1, -1);
    }

    return translated;
  } catch (error: any) {
    console.error(`翻译失败 (${targetLang}):`, error.message);
    throw error;
  }
}

// 检查是否需要翻译
function needsTranslation(q: Question): boolean {
  if (typeof q.content === "string") {
    return true; // 字符串格式需要转换
  }
  
  const content = q.content as { zh: string; en: string; ja: string };
  return (
    !content.en || 
    content.en.startsWith("[EN]") || 
    !content.ja || 
    content.ja.startsWith("[JA]")
  );
}

// 翻译单个问题
async function translateQuestion(q: Question): Promise<Question> {
  let zhContent: string;
  let zhExplanation: string | undefined;

  // 获取中文内容
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

  // 检查是否需要翻译
  if (!needsTranslation(q)) {
    return q; // 已经翻译过了
  }

  console.log(`  翻译问题 ${q.id}: ${zhContent.substring(0, 50)}...`);

  try {
    // 翻译content
    const [enContent, jaContent] = await Promise.all([
      translateWithAI(zhContent, "en"),
      translateWithAI(zhContent, "ja"),
    ]);

    // 翻译explanation（如果存在）
    let enExplanation: string | undefined;
    let jaExplanation: string | undefined;
    if (zhExplanation) {
      [enExplanation, jaExplanation] = await Promise.all([
        translateWithAI(zhExplanation, "en"),
        translateWithAI(zhExplanation, "ja"),
      ]);
    }

    // 更新问题
    const updated: Question = {
      ...q,
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

    // 延迟以避免API限流
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_QUESTIONS));

    return updated;
  } catch (error: any) {
    console.error(`  翻译问题 ${q.id} 失败:`, error.message);
    // 返回原始问题，但标记为需要翻译
    return {
      ...q,
      content: typeof q.content === "string" 
        ? { zh: q.content, en: `[EN] ${q.content}`, ja: `[JA] ${q.content}` }
        : q.content,
    };
  }
}

async function main() {
  console.log("开始批量翻译...");
  console.log(`输入文件: ${INPUT_FILE}`);
  console.log(`批次大小: ${BATCH_SIZE}`);
  console.log(`AI服务URL: ${getAiServiceUrl()}\n`);

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
        const translatedQ = await translateQuestion(q);
        questions[index] = translatedQ;
        processed++;
        translated++;

        // 每处理10个问题保存一次
        if (processed % 10 === 0) {
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
  console.log(`失败: ${failed}`);

  // 重新统计翻译状态
  const finalNeedsTranslation = questions.filter(needsTranslation).length;
  const finalTranslated = questions.length - finalNeedsTranslation;
  console.log(`\n最终状态:`);
  console.log(`  已翻译: ${finalTranslated}/${questions.length} (${((finalTranslated / questions.length) * 100).toFixed(2)}%)`);
  console.log(`  待翻译: ${finalNeedsTranslation}/${questions.length} (${((finalNeedsTranslation / questions.length) * 100).toFixed(2)}%)`);
}

main().catch((error) => {
  console.error("处理过程中发生错误:", error);
  process.exit(1);
});

