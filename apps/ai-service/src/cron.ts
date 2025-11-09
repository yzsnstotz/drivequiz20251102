// apps/ai-service/src/cron.ts
/**
 * Render Cron 任务入口文件
 * 
 * 用于 Render Cron 作业独立执行每日摘要任务
 * 启动命令：node dist/cron.js
 */

import dotenv from "dotenv";
import { loadConfig } from "./index.js";
import { runDailySummarize } from "./tasks/dailySummarize.js";

// 加载环境变量
dotenv.config();

/**
 * 主函数：执行一次摘要任务
 */
async function main() {
  try {
    console.log("[CRON] Starting daily summarize task...");
    
    // 加载配置
    const config = loadConfig();
    
    // 计算昨天日期（UTC）
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const yesterday = new Date(todayUtc.getTime() - 24 * 3600 * 1000);
    const dateUtc = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterday.getUTCDate()).padStart(2, "0")}`;
    
    console.log("[CRON] Processing date:", dateUtc);
    
    // 执行摘要任务
    const result = await runDailySummarize(config, {
      dateUtc,
      fetchLogs: async (fromIso, toIso) => {
        // 使用配置中的 fetchAskLogs provider
        const anyCfg = config as any;
        const fetchLogs = anyCfg?.providers?.fetchAskLogs || anyCfg?.fetchAskLogs;
        
        if (fetchLogs) {
          return await fetchLogs(fromIso, toIso);
        }
        
        // 如果没有 provider，返回空数组
        console.warn("[CRON] No fetchLogs provider configured, returning empty array");
        return [];
      },
      maxRecords: Number(process.env.CRON_DAILY_SUMMARY_MAX_RECORDS || 1000),
    });
    
    if (result.ok) {
      console.log("[CRON] Daily summarize task completed successfully");
      console.log("[CRON] Summary data:", {
        dateUtc: result.data.dateUtc,
        totals: result.data.totals,
        topQuestionsCount: result.data.topQuestions.length,
        topSourcesCount: result.data.topSources.length,
        gapsCount: result.data.gaps.length,
      });
      process.exit(0);
    } else {
      console.error("[CRON] Daily summarize task failed:", {
        errorCode: result.errorCode,
        message: result.message,
      });
      process.exit(1);
    }
  } catch (error) {
    console.error("[CRON] Fatal error:", error);
    process.exit(1);
  }
}

// 执行主函数
main();

