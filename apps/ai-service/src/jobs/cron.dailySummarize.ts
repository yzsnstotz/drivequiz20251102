// apps/ai-service/src/jobs/cron.dailySummarize.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ZALEM · AI-Service · Daily Summarize Cron (UTC)
 *
 * 目标：
 *  - 每日按 UTC 指定时间运行 runDailySummarize（默认 02:00 UTC）
 *  - 从配置或注入的 provider 拉取问答日志
 *  - 将结果写入缓存键：ai:summary:<YYYY-MM-DD>:day（由任务内部完成）
 *
 * 依赖：
 *  - 无第三方定时库；使用 setTimeout + 24h 节拍，避免额外依赖
 *  - 环境变量可控制：启用/禁用、小时/分钟、开机即跑、最大记录数
 *
 * 环境变量：
 *  - CRON_DAILY_SUMMARY_ENABLED        (default: "true")
 *  - CRON_DAILY_SUMMARY_UTC_HOUR       (default: "2")
 *  - CRON_DAILY_SUMMARY_UTC_MINUTE     (default: "0")
 *  - CRON_DAILY_SUMMARY_RUN_ON_BOOT    (default: "0")  // "1" 则服务启动即跑一次（跑昨天）
 *  - CRON_DAILY_SUMMARY_MAX_RECORDS    (default: "1000")
 */

import type { FastifyInstance } from "fastify";
import type { ServiceConfig } from "../index.js";
import { runDailySummarize } from "../tasks/dailySummarize.js";

/** 可选：从 config 中解析日志 provider */
type FetchLogs = (fromIso: string, toIso: string) => Promise<
  Array<{
    id: string;
    userId: string | null;
    question: string;
    answer?: string;
    locale?: string;
    createdAt: string;
    sources?: Array<{ title: string; url: string; score?: number }>;
    safetyFlag?: "ok" | "needs_human" | "blocked";
    model?: string;
    meta?: Record<string, unknown>;
  }>
>;

function getEnvBoolean(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}

function getEnvInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? (v as number) : fallback;
}

/** 计算下一次在 UTC 指定时刻触发的时间点（毫秒时间戳） */
function nextUtcTime(hour: number, minute: number): number {
  const now = Date.now();
  const d = new Date();
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, minute, 0, 0);
  const first = next > now ? next : next + 24 * 3600 * 1000;
  return first;
}

/** 计算“昨天”的 UTC 日期字符串（YYYY-MM-DD） */
function yesterdayUtcDate(): string {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
  const y = new Date(todayUtc - 24 * 3600 * 1000);
  const mm = String(y.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(y.getUTCDate()).padStart(2, "0");
  return `${y.getUTCFullYear()}-${mm}-${dd}`;
}

/**
 * 注册每日定时任务。
 * 返回一个取消函数，可在应用关闭时调用以清理定时器。
 */
export function registerCronDailySummarize(
  _app: FastifyInstance,
  config: ServiceConfig,
): () => void {
  const enabled = getEnvBoolean("CRON_DAILY_SUMMARY_ENABLED", true);
  if (!enabled) {
    return () => void 0;
  }

  const hour = getEnvInt("CRON_DAILY_SUMMARY_UTC_HOUR", 2);
  const minute = getEnvInt("CRON_DAILY_SUMMARY_UTC_MINUTE", 0);
  const runOnBoot = getEnvBoolean("CRON_DAILY_SUMMARY_RUN_ON_BOOT", false);
  const maxRecords = getEnvInt("CRON_DAILY_SUMMARY_MAX_RECORDS", 1000);

  // 解析 fetchLogs provider：优先 config.providers.fetchAskLogs → config.fetchAskLogs
  const anyCfg = config as any;
  const fetchLogs: FetchLogs | undefined =
    anyCfg?.providers?.fetchAskLogs || anyCfg?.fetchAskLogs;

  // fetchLogs provider check removed for performance

  let timer: NodeJS.Timeout | null = null;

  /** 实际执行一次任务（默认 dateUtc=昨天），独立函数便于复用与错误捕获 */
  const runOnce = async (_tag: string, dateUtc = yesterdayUtcDate()) => {
    try {
      await runDailySummarize(config, {
        dateUtc,
        fetchLogs: async (fromIso, toIso) => {
          try {
            if (fetchLogs) return await fetchLogs(fromIso, toIso);
            return [];
          } catch (e) {
            return [];
          }
        },
        maxRecords,
      });
    } catch (e) {
      // Silent failure
    }
  };

  // 可选：启动即跑（跑昨天）
  if (runOnBoot) {
    // 不阻塞启动流程
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    runOnce("boot");
  }

  // 计划下一次触发
  const scheduleNext = () => {
    const at = nextUtcTime(hour, minute);
    const delay = Math.max(0, at - Date.now());
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      await runOnce("scheduled");
      timer = setTimeout(async () => {
        await runOnce("interval");
        scheduleNext();
      }, 24 * 3600 * 1000);
    }, delay);
  };

  scheduleNext();

  // 取消函数
  return () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
}

/**
 * 手动触发：供其他模块按需调用（如管理 API）
 * - 若未传 dateUtc，则使用昨天（UTC）
 */
export async function triggerDailySummarizeOnce(
  _app: FastifyInstance,
  config: ServiceConfig,
  opts?: { dateUtc?: string; maxRecords?: number },
): Promise<void> {
  const anyCfg = config as any;
  const fetchLogs: FetchLogs | undefined =
    anyCfg?.providers?.fetchAskLogs || anyCfg?.fetchAskLogs;

  const dateUtc = opts?.dateUtc || yesterdayUtcDate();
  const maxRecords = typeof opts?.maxRecords === "number" ? opts!.maxRecords : getEnvInt("CRON_DAILY_SUMMARY_MAX_RECORDS", 1000);

  try {
    await runDailySummarize(config, {
      dateUtc,
      fetchLogs: async (fromIso, toIso) => {
        try {
          if (fetchLogs) return await fetchLogs(fromIso, toIso);
          return [];
        } catch (e) {
          return [];
        }
      },
      maxRecords,
    });
  } catch (e) {
    // Silent failure
  }
}
