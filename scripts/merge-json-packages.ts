// ============================================================
// 脚本：合并所有JSON包到一个统一的questions.json文件
// ============================================================

import fs from "fs/promises";
import path from "path";

const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");
const OUTPUT_FILE = path.join(QUESTIONS_DIR, "questions.json");

interface Question {
  id: number;
  type: "single" | "multiple" | "truefalse";
  content: string;
  options?: string[];
  correctAnswer: string | string[];
  image?: string;
  explanation?: string;
  category?: string;
  hash?: string;
}

interface QuestionFile {
  questions: Question[];
  version?: string;
  aiAnswers?: Record<string, string>;
}

async function getAllJsonFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(QUESTIONS_DIR);
    return files
      .filter((f) => f.endsWith(".json") && f !== "questions.json")
      .map((f) => f.replace(".json", ""));
  } catch (error) {
    console.error("[getAllJsonFiles] Error:", error);
    return [];
  }
}

async function loadQuestionFile(packageName: string): Promise<QuestionFile | null> {
  try {
    const filePath = path.join(QUESTIONS_DIR, `${packageName}.json`);
    const content = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    
    // 兼容多种格式
    if (Array.isArray(data)) {
      return { questions: data };
    }
    
    return {
      questions: data.questions || [],
      version: data.version,
      aiAnswers: data.aiAnswers || {},
    };
  } catch (error) {
    console.error(`[loadQuestionFile] Error loading ${packageName}:`, error);
    return null;
  }
}

async function mergeJsonPackages() {
  try {
    console.log("[mergeJsonPackages] 开始合并JSON包...");
    
    const packageNames = await getAllJsonFiles();
    console.log(`[mergeJsonPackages] 找到 ${packageNames.length} 个JSON包文件`);
    
    const allQuestions: Question[] = [];
    const allAiAnswers: Record<string, string> = {};
    let unifiedVersion: string | undefined;
    
    // 读取所有JSON包
    for (const packageName of packageNames) {
      const file = await loadQuestionFile(packageName);
      if (file && file.questions && file.questions.length > 0) {
        console.log(`[mergeJsonPackages] 处理 ${packageName}: ${file.questions.length} 个题目`);
        
        // 为每个题目设置category（如果还没有）
        const questionsWithCategory = file.questions.map((q) => ({
          ...q,
          category: q.category || packageName,
        }));
        
        allQuestions.push(...questionsWithCategory);
        
        // 合并AI回答
        if (file.aiAnswers) {
          Object.assign(allAiAnswers, file.aiAnswers);
        }
        
        // 使用最新的版本号
        if (file.version && (!unifiedVersion || file.version > unifiedVersion)) {
          unifiedVersion = file.version;
        }
      }
    }
    
    console.log(`[mergeJsonPackages] 总共合并了 ${allQuestions.length} 个题目`);
    console.log(`[mergeJsonPackages] 总共合并了 ${Object.keys(allAiAnswers).length} 个AI回答`);
    
    // 创建统一的JSON包
    const unifiedPackage: QuestionFile = {
      questions: allQuestions,
      version: unifiedVersion,
      aiAnswers: allAiAnswers,
    };
    
    // 保存到questions.json
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(unifiedPackage, null, 2), "utf-8");
    
    console.log(`[mergeJsonPackages] 成功创建统一的JSON包: ${OUTPUT_FILE}`);
    console.log(`[mergeJsonPackages] 版本号: ${unifiedVersion || "无"}`);
    
    return {
      totalQuestions: allQuestions.length,
      totalAiAnswers: Object.keys(allAiAnswers).length,
      version: unifiedVersion,
    };
  } catch (error) {
    console.error("[mergeJsonPackages] Error:", error);
    throw error;
  }
}

// 执行合并
if (require.main === module) {
  mergeJsonPackages()
    .then((result) => {
      console.log("[mergeJsonPackages] 完成:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("[mergeJsonPackages] 失败:", error);
      process.exit(1);
    });
}

export { mergeJsonPackages };

