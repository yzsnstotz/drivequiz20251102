/**
 * AI聊天行为缓存服务（服务端）
 * 用于去重和批量汇总AI聊天行为记录
 */

import crypto from 'crypto';
import { db } from './db';

interface ChatRecord {
  // ⚠️ 注意：userId 现在是字符串类型（UUID），不再使用 number
  userId: string;
  questionHash: string; // 问题的hash，用于去重
  timestamp: number;
  ipAddress: string | null;
  userAgent: string | null;
  clientType: string | null;
}

class AiChatBehaviorCacheServer {
  // ⚠️ 注意：userId 现在是字符串类型（UUID），不再使用 number
  private cache: Map<string, ChatRecord[]> = new Map(); // userId -> ChatRecord[]
  private flushInterval: number = 30000; // 30秒自动刷新（减少延迟，更快看到记录）
  private maxCacheSize: number = 1000; // 最大缓存条数
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing: boolean = false;

  constructor() {
    // 启动定时刷新
    this.startAutoFlush();
  }

  /**
   * 生成问题的hash（用于去重）
   */
  private hashQuestion(question: string): string {
    return crypto.createHash('sha256').update(question.trim().toLowerCase()).digest('hex');
  }

  /**
   * 添加聊天记录到缓存（自动去重）
   * @param immediateFlush 是否立即写入数据库（在Serverless环境中建议使用）
   */
  addChatRecord(
    // ⚠️ 注意：userId 现在是字符串类型（UUID），不再使用 number
    userId: string,
    question: string,
    ipAddress: string | null = null,
    userAgent: string | null = null,
    clientType: string | null = null,
    immediateFlush: boolean = false
  ): void {
    try {
      const questionHash = this.hashQuestion(question);
      const now = Date.now();

      // 获取用户的缓存记录
      let userRecords = this.cache.get(userId) || [];

      // 检查是否已存在相同的记录（去重：相同问题在5分钟内只记录一次）
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      const existingRecord = userRecords.find(
        (r) => r.questionHash === questionHash && r.timestamp > fiveMinutesAgo
      );

      if (existingRecord) {
        // 如果已存在，不重复添加
        console.log('[AiChatBehaviorCacheServer] Duplicate record skipped', {
          userId,
          questionHash: questionHash.substring(0, 8),
        });
        return;
      }

      // 添加新记录
      userRecords.push({
        userId,
        questionHash,
        timestamp: now,
        ipAddress,
        userAgent,
        clientType,
      });

      console.log('[AiChatBehaviorCacheServer] Added record to cache', {
        userId,
        cacheSize: userRecords.length,
        questionHash: questionHash.substring(0, 8),
      });

      // 限制缓存大小（按时间倒序，保留最新的）
      if (userRecords.length > this.maxCacheSize) {
        userRecords = userRecords
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, this.maxCacheSize);
      }

      this.cache.set(userId, userRecords);

      // 如果要求立即刷新，或者缓存太大，立即刷新
      if (immediateFlush || this.getTotalCacheSize() > this.maxCacheSize) {
        // 立即写入这条记录（不等待批量）
        this.flushImmediateRecord(userId, {
          userId,
          questionHash,
          timestamp: now,
          ipAddress,
          userAgent,
          clientType,
        }).catch((error) => {
          console.error('[AiChatBehaviorCacheServer] Immediate flush error:', error);
        });
      }
    } catch (error) {
      console.error('[AiChatBehaviorCacheServer] Error adding record:', error);
    }
  }

  /**
   * 立即写入单条记录（用于Serverless环境）
   */
  // ⚠️ 注意：userId 现在是字符串类型（UUID），不再使用 number
  private async flushImmediateRecord(userId: string, record: ChatRecord): Promise<void> {
    try {
      await this.batchWriteRecords(userId, [record]);
      // 从缓存中移除已写入的记录
      const userRecords = this.cache.get(userId) || [];
      const filtered = userRecords.filter(
        (r) => r.questionHash !== record.questionHash || r.timestamp !== record.timestamp
      );
      if (filtered.length === 0) {
        this.cache.delete(userId);
      } else {
        this.cache.set(userId, filtered);
      }
    } catch (error) {
      console.error('[AiChatBehaviorCacheServer] Failed to flush immediate record:', error);
      // 失败时保留在缓存中，等待下次批量刷新
    }
  }

  /**
   * 获取缓存大小
   */
  private getTotalCacheSize(): number {
    let total = 0;
    this.cache.forEach((records) => {
      total += records.length;
    });
    return total;
  }

  /**
   * 刷新缓存到数据库（批量写入）
   */
  async flush(): Promise<void> {
    if (this.isFlushing) {
      return; // 正在刷新，跳过
    }

    this.isFlushing = true;
    const recordsMap = new Map(this.cache);
    
    if (recordsMap.size === 0) {
      this.isFlushing = false;
      return;
    }

    try {
      // 清空缓存（先清空，避免刷新期间有新记录）
      this.cache.clear();

      // 批量写入数据库
      console.log(`[AiChatBehaviorCacheServer] Flushing ${recordsMap.size} users' chat records`);
      
      // 遍历每个用户的记录，批量写入
      const writePromises = Array.from(recordsMap.entries()).map(async ([userId, records]) => {
        if (records.length > 0) {
          await this.batchWriteRecords(userId, records);
        }
      });
      await Promise.all(writePromises);
    } catch (error) {
      console.error('[AiChatBehaviorCacheServer] Failed to flush cache:', error);
      // 刷新失败，将记录重新放回缓存（避免丢失）
      recordsMap.forEach((records, userId) => {
        const existing = this.cache.get(userId) || [];
        this.cache.set(userId, [...existing, ...records]);
      });
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * 批量写入记录到数据库
   */
  private async batchWriteRecords(userId: number, records: ChatRecord[]): Promise<void> {
    try {
      // 批量插入到user_behaviors表
      // 每条记录代表一次AI聊天，使用metadata存储聊天条数
      const values = records.map((r) => ({
        user_id: userId,
        behavior_type: 'ai_chat' as const,
        ip_address: r.ipAddress,
        user_agent: r.userAgent,
        client_type: r.clientType as 'web' | 'mobile' | 'api' | 'desktop' | 'other' | null,
        metadata: {
          chat_count: 1, // 每条记录代表1次聊天
          question_hash: r.questionHash, // 存储问题hash用于去重验证
          timestamp: r.timestamp,
        },
        created_at: new Date(r.timestamp),
      }));

      console.log(`[AiChatBehaviorCacheServer] Writing ${records.length} records for user ${userId}`, {
        userId,
        recordCount: records.length,
        firstRecord: {
          timestamp: records[0]?.timestamp,
          questionHash: records[0]?.questionHash?.substring(0, 8),
        },
      });

      // 批量插入
      await db.insertInto('user_behaviors').values(values).execute();

      console.log(`[AiChatBehaviorCacheServer] Successfully wrote ${records.length} records for user ${userId}`);
    } catch (error) {
      console.error(`[AiChatBehaviorCacheServer] Failed to batch write for user ${userId}:`, error);
      if (error instanceof Error) {
        console.error(`[AiChatBehaviorCacheServer] Error details:`, {
          message: error.message,
          stack: error.stack?.substring(0, 500),
        });
      }
      throw error;
    }
  }

  /**
   * 启动自动刷新
   */
  private startAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        console.error('[AiChatBehaviorCacheServer] Auto flush error:', error);
      });
    }, this.flushInterval);
  }

  /**
   * 停止自动刷新
   */
  stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * 手动刷新（用于程序退出时）
   */
  async shutdown(): Promise<void> {
    this.stopAutoFlush();
    await this.flush();
  }
}

// 导出单例（服务端全局实例）
let cacheInstance: AiChatBehaviorCacheServer | null = null;

export function getAiChatBehaviorCache(): AiChatBehaviorCacheServer {
  if (!cacheInstance) {
    cacheInstance = new AiChatBehaviorCacheServer();
  }
  return cacheInstance;
}

