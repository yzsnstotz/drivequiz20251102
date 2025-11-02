export const fetchCache = "force-no-store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // 强制使用 Node.js runtime，避免 Edge runtime 兼容性问题

// ============================================================
// 文件路径: src/app/api/admin/questions/import/route.ts
// 功能: 从Excel批量导入题目
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";
import { logCreate } from "@/app/api/_lib/operationLog";
import * as XLSX from "xlsx";
import fs from "fs/promises";
import path from "path";
import type { Question, QuestionFile } from "../route";

// 题目数据目录
const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");

// 加载指定卷类的题目文件
async function loadQuestionFile(category: string): Promise<QuestionFile | null> {
  try {
    const filePath = path.join(QUESTIONS_DIR, `${category}.json`);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as QuestionFile;
  } catch (error) {
    console.error(`[loadQuestionFile] Error loading ${category}:`, error);
    return null;
  }
}

// 保存题目文件
async function saveQuestionFile(category: string, data: QuestionFile): Promise<void> {
  const filePath = path.join(QUESTIONS_DIR, `${category}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// 解析Excel行数据为题目对象
function parseQuestionRow(row: any, rowIndex: number): {
  question: Question | null;
  error: string | null;
} {
  try {
    const category = String(row.卷类 || row.category || "").trim();
    const type = String(row.类型 || row.type || "").toLowerCase().trim();
    const content = String(row.题目内容 || row.content || "").trim();
    const answer = String(row.正确答案 || row.answer || row.correctAnswer || "").trim();
    const image = String(row.图片URL || row.image || "").trim();
    const explanation = String(row.解析 || row.explanation || "").trim();

    // 校验必填字段
    if (!category) {
      return { question: null, error: `第${rowIndex + 1}行: 卷类不能为空` };
    }

    if (!type || !["single", "multiple", "truefalse"].includes(type)) {
      return { question: null, error: `第${rowIndex + 1}行: 类型必须是 single/multiple/truefalse` };
    }

    if (!content) {
      return { question: null, error: `第${rowIndex + 1}行: 题目内容不能为空` };
    }

    if (!answer) {
      return { question: null, error: `第${rowIndex + 1}行: 正确答案不能为空` };
    }

    // 解析选项
    const options: string[] = [];
    if (type === "single" || type === "multiple") {
      const optA = String(row.选项A || row.optionA || row["选项A"] || "").trim();
      const optB = String(row.选项B || row.optionB || row["选项B"] || "").trim();
      const optC = String(row.选项C || row.optionC || row["选项C"] || "").trim();
      const optD = String(row.选项D || row.optionD || row["选项D"] || "").trim();

      if (optA) options.push(optA);
      if (optB) options.push(optB);
      if (optC) options.push(optC);
      if (optD) options.push(optD);

      if (options.length < 2) {
        return { question: null, error: `第${rowIndex + 1}行: 单选题/多选题至少需要2个选项` };
      }
    }

    // 解析正确答案
    let correctAnswer: string | string[];
    if (type === "truefalse") {
      const answerLower = answer.toLowerCase();
      if (answerLower === "true" || answerLower === "1" || answerLower === "是" || answerLower === "o") {
        correctAnswer = "true";
      } else if (answerLower === "false" || answerLower === "0" || answerLower === "否" || answerLower === "x") {
        correctAnswer = "false";
      } else {
        return { question: null, error: `第${rowIndex + 1}行: 判断题答案必须是 true/false` };
      }
    } else if (type === "single") {
      // 单选题: 答案应该是单个选项字母或选项内容
      if (["a", "b", "c", "d"].includes(answer.toLowerCase())) {
        correctAnswer = answer.toUpperCase();
      } else {
        // 尝试匹配选项内容
        const matchedIndex = options.findIndex((opt) => opt === answer);
        if (matchedIndex >= 0) {
          correctAnswer = String.fromCharCode(65 + matchedIndex); // A, B, C, D
        } else {
          return { question: null, error: `第${rowIndex + 1}行: 单选题答案格式错误` };
        }
      }
    } else {
      // 多选题: 答案应该是逗号分隔的选项字母或选项内容
      const answerParts = answer.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      const correctAnswers: string[] = [];
      
      for (const part of answerParts) {
        if (["a", "b", "c", "d"].includes(part.toLowerCase())) {
          correctAnswers.push(part.toUpperCase());
        } else {
          const matchedIndex = options.findIndex((opt) => opt === part);
          if (matchedIndex >= 0) {
            correctAnswers.push(String.fromCharCode(65 + matchedIndex));
          } else {
            return { question: null, error: `第${rowIndex + 1}行: 多选题答案格式错误: ${part}` };
          }
        }
      }

      if (correctAnswers.length === 0) {
        return { question: null, error: `第${rowIndex + 1}行: 多选题至少需要一个正确答案` };
      }

      correctAnswer = correctAnswers;
    }

    const question: Question = {
      id: 0, // 将在保存时分配
      type: type as Question["type"],
      content,
      correctAnswer,
      ...(options.length > 0 ? { options } : {}),
      ...(image ? { image } : {}),
      ...(explanation ? { explanation } : {}),
    };

    return { question, error: null };
  } catch (error: any) {
    return { question: null, error: `第${rowIndex + 1}行: 解析错误 - ${error.message}` };
  }
}

// ============================================================
// POST /api/admin/questions/import
// 从Excel批量导入题目
// ============================================================
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    // 解析FormData(包含Excel文件)
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return badRequest("Excel file is required");
    }

    // 验证文件类型
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      return badRequest("Only Excel files (.xlsx, .xls) are supported");
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 解析Excel
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // 转换为JSON
    const rows = XLSX.utils.sheet_to_json(worksheet);

    if (rows.length === 0) {
      return badRequest("Excel file is empty");
    }

    // 解析每一行
    const results: {
      success: number;
      failed: number;
      errors: string[];
      questions: (Question & { category: string })[];
    } = {
      success: 0,
      failed: 0,
      errors: [],
      questions: [],
    };

    // 按卷类分组
    const questionsByCategory = new Map<string, Question[]>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as any;
      const { question, error } = parseQuestionRow(row, i);

      if (error) {
        results.failed++;
        results.errors.push(error);
        continue;
      }

      if (!question) continue;

      // 获取卷类
      const category = String(row.卷类 || row.category || "免许-1").trim();

      // 添加到对应卷类
      if (!questionsByCategory.has(category)) {
        questionsByCategory.set(category, []);
      }
      questionsByCategory.get(category)!.push(question);
    }

    // 保存到文件
    for (const [category, questions] of Array.from(questionsByCategory.entries())) {
      let file = await loadQuestionFile(category);
      if (!file) {
        file = { questions: [] };
      }

      // 为每个题目分配ID
      const maxId = file.questions.length > 0
        ? Math.max(...file.questions.map((q) => q.id))
        : 0;

      questions.forEach((q, index) => {
        q.id = maxId + index + 1;
      });

      // 添加到文件
      file.questions.push(...questions);

      // 保存文件
      await saveQuestionFile(category, file);

      // 记录操作日志
      for (const question of questions) {
        try {
          await logCreate(req, "question", question.id, {
            category,
            type: question.type,
            content: question.content.substring(0, 50),
            imported: true,
          });
        } catch (logErr) {
          console.error("[POST /api/admin/questions/import] Log error:", logErr);
        }
      }

      results.success += questions.length;
      results.questions.push(
        ...questions.map((q) => ({ ...q, category }))
      );
    }

    return success(results);
  } catch (err: any) {
    console.error("[POST /api/admin/questions/import] Error:", err);
    if (err.ok === false) return err;
    return internalError("Failed to import questions");
  }
});

