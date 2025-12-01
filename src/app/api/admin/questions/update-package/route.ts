// ============================================================
// 文件路径: src/app/api/admin/questions/update-package/route.ts
// 功能: 手动更新 JSON 包（重新计算 hash 并更新统一版本号）
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, internalError } from "@/app/api/_lib/errors";
import { updateAllJsonPackages } from "@/lib/questionDb";

// ============================================================
// POST /api/admin/questions/update-package
// 手动更新所有 JSON 包（重新计算 hash 并更新统一版本号）
// ============================================================
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    // 使用统一版本号更新所有JSON包
    const result = await updateAllJsonPackages();

    // 构建详细的更新说明
    let message = `JSON 包更新完成：统一版本号 ${result.version}\n\n`;
    message += `📊 题目统计：\n`;
    message += `  - 总题目数：${result.totalQuestions} 个\n`;
    if (result.previousVersion) {
      message += `  - 新增题目：${result.questionsAdded || 0} 个\n`;
      message += `  - 更新题目：${result.questionsUpdated || 0} 个\n`;
      message += `  - 上一版本：${result.previousVersion}（${result.previousTotalQuestions || 0} 个题目）\n`;
    } else {
      message += `  - 新增题目：${result.questionsAdded || 0} 个（首次生成）\n`;
    }
    message += `\n🤖 AI回答统计：\n`;
    message += `  - 总AI回答数：${result.aiAnswersCount} 个\n`;
    if (result.previousVersion) {
      message += `  - 新增AI回答：${result.aiAnswersAdded || 0} 个\n`;
      message += `  - 更新AI回答：${result.aiAnswersUpdated || 0} 个\n`;
      message += `  - 上一版本：${result.previousAiAnswersCount || 0} 个AI回答\n`;
    } else {
      message += `  - 新增AI回答：${result.aiAnswersAdded || 0} 个（首次生成）\n`;
    }
    
    // 添加数据一致性验证报告
    if (result.validationReport) {
      message += `\n✅ 数据一致性验证：\n`;
      if (result.validationReport.isConsistent) {
        message += `  - 状态：通过 ✓\n`;
        message += `  - 数据库题目数：${result.validationReport.dbQuestionCount} 个\n`;
        message += `  - JSON包题目数：${result.validationReport.jsonQuestionCount} 个\n`;
      } else {
        message += `  - 状态：失败 ✗\n`;
        message += `  - 数据库题目数：${result.validationReport.dbQuestionCount} 个\n`;
        message += `  - JSON包题目数：${result.validationReport.jsonQuestionCount} 个\n`;
        if (result.validationReport.missingQuestionIds.length > 0) {
          message += `  - 丢失题目数：${result.validationReport.missingQuestionIds.length} 个\n`;
          message += `  - 丢失题目ID：${result.validationReport.missingQuestionIds.slice(0, 10).join(', ')}${result.validationReport.missingQuestionIds.length > 10 ? '...' : ''}\n`;
        }
        if (result.validationReport.conversionErrors.length > 0) {
          message += `  - 转换失败题目数：${result.validationReport.conversionErrors.length} 个\n`;
        }
        if (result.validationReport.warnings.length > 0) {
          message += `  - 警告数量：${result.validationReport.warnings.length} 个\n`;
          result.validationReport.warnings.slice(0, 5).forEach((warning, idx) => {
            message += `    ${idx + 1}. ${warning}\n`;
          });
          if (result.validationReport.warnings.length > 5) {
            message += `    ... 还有 ${result.validationReport.warnings.length - 5} 个警告\n`;
          }
        }
      }
    }

    return success({
      version: result.version,
      totalQuestions: result.totalQuestions,
      aiAnswersCount: result.aiAnswersCount,
      previousVersion: result.previousVersion,
      previousTotalQuestions: result.previousTotalQuestions,
      previousAiAnswersCount: result.previousAiAnswersCount,
      questionsAdded: result.questionsAdded,
      questionsUpdated: result.questionsUpdated,
      aiAnswersAdded: result.aiAnswersAdded,
      aiAnswersUpdated: result.aiAnswersUpdated,
      validationReport: result.validationReport,
      message,
    });
  } catch (err: any) {
    console.error("[POST /api/admin/questions/update-package] Error:", err);
    return internalError("Failed to update question package");
  }
});

