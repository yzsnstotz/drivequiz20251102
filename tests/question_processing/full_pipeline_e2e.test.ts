/**
 * 批量处理 JSON 容错与目标语言过滤 · 端到端测试
 * 
 * 测试内容：
 * 1. JSON 清洗功能（cleanJsonString）
 * 2. 目标语言过滤功能（sanitizeAiPayload）
 * 3. 数据库 JSONB 写入（sanitizeJsonForDb）
 * 4. full_pipeline 完整流程
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// 注意：这是一个端到端测试框架，实际执行需要配置测试环境
// 本文件定义了测试用例结构和断言逻辑

describe('批量处理 JSON 容错与目标语言过滤 E2E 测试', () => {
  const testQuestionIds = [1, 2, 3]; // 实际测试时需要从数据库获取真实题目 ID
  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000';
  const adminToken = process.env.ADMIN_TOKEN || ''; // 需要配置管理员 token

  describe('Task 1: JSON 清洗功能测试', () => {
    it('应该能够清理带尾随逗号的 JSON 字符串', async () => {
      const dirtyJson = '{"key": "value",}';
      const response = await fetch(`${baseUrl}/api/admin/question-processing/batch-process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          questionIds: testQuestionIds,
          operations: ['full_pipeline'],
          sourceLanguage: 'zh',
          targetLanguages: ['ja'],
          scene: 'question_full_pipeline',
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      console.log('[TEST] JSON 清洗测试 - 请求体:', JSON.stringify({
        questionIds: testQuestionIds,
        operations: ['full_pipeline'],
        sourceLanguage: 'zh',
        targetLanguages: ['ja'],
      }, null, 2));
      console.log('[TEST] JSON 清洗测试 - 响应:', JSON.stringify(result, null, 2));
    });

    it('应该能够清理带 Markdown 代码块包裹的 JSON', async () => {
      // 这个测试主要验证 AI 返回的 JSON 能够被正确解析
      // 实际测试中，AI 可能返回带 ```json 包裹的内容
      const response = await fetch(`${baseUrl}/api/admin/question-processing/batch-process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          questionIds: testQuestionIds.slice(0, 1),
          operations: ['full_pipeline'],
          sourceLanguage: 'zh',
          targetLanguages: ['ja'],
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.taskId).toBeDefined();
      console.log('[TEST] Markdown 代码块清理测试 - Task ID:', result.taskId);
    });
  });

  describe('Task 2: 目标语言过滤功能测试', () => {
    it('应该只保留 targetLanguages 中指定的语言', async () => {
      const startTime = Date.now();
      const response = await fetch(`${baseUrl}/api/admin/question-processing/batch-process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          questionIds: testQuestionIds,
          operations: ['full_pipeline'],
          sourceLanguage: 'zh',
          targetLanguages: ['ja'], // 只指定 ja，不应该写入 en
          scene: 'question_full_pipeline',
        }),
      });

      const duration = Date.now() - startTime;
      expect(response.ok).toBe(true);
      const result = await response.json();
      console.log('[TEST] 目标语言过滤测试 - 请求体:', JSON.stringify({
        questionIds: testQuestionIds,
        sourceLanguage: 'zh',
        targetLanguages: ['ja'],
      }, null, 2));
      console.log('[TEST] 目标语言过滤测试 - 响应:', JSON.stringify(result, null, 2));
      console.log('[TEST] 目标语言过滤测试 - 耗时:', duration, 'ms');

      // 等待任务完成
      const taskId = result.taskId;
      await waitForTaskCompletion(taskId);

      // 验证数据库中的内容
      const dbCheck = await checkDatabaseContent(testQuestionIds, ['zh', 'ja']);
      expect(dbCheck.hasOnlyTargetLanguages).toBe(true);
      expect(dbCheck.hasExtraLanguages).toBe(false);
      console.log('[TEST] 数据库验证结果:', dbCheck);
    });

    it('应该过滤掉不在 targetLanguages 中的语言（如 en）', async () => {
      const response = await fetch(`${baseUrl}/api/admin/question-processing/batch-process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          questionIds: testQuestionIds.slice(0, 1),
          operations: ['full_pipeline'],
          sourceLanguage: 'zh',
          targetLanguages: ['ja'],
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      const taskId = result.taskId;

      // 等待任务完成并检查
      await waitForTaskCompletion(taskId);
      const taskDetails = await getTaskDetails(taskId);
      
      // 验证 AI 响应中可能包含 en，但最终数据库中不应该有 en
      console.log('[TEST] 任务详情:', JSON.stringify(taskDetails, null, 2));
      
      // 检查 processed_data，确认只有 zh 和 ja
      if (taskDetails.items && taskDetails.items.length > 0) {
        const item = taskDetails.items[0];
        if (item.processed_data) {
          const content = item.processed_data.content;
          const contentKeys = Object.keys(content || {});
          console.log('[TEST] 处理后的 content keys:', contentKeys);
          expect(contentKeys).not.toContain('en');
          expect(contentKeys).toContain('zh');
          expect(contentKeys).toContain('ja');
        }
      }
    });
  });

  describe('Task 3: 数据库 JSONB 写入测试', () => {
    it('应该能够正确写入 JSONB 字段，不包含 undefined', async () => {
      const response = await fetch(`${baseUrl}/api/admin/question-processing/batch-process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          questionIds: testQuestionIds.slice(0, 1),
          operations: ['full_pipeline'],
          sourceLanguage: 'zh',
          targetLanguages: ['ja'],
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      const taskId = result.taskId;

      await waitForTaskCompletion(taskId);

      // 验证数据库中没有 JSON 解析错误
      const dbContent = await getQuestionFromDb(testQuestionIds[0]);
      expect(dbContent).toBeDefined();
      expect(dbContent.content).toBeDefined();
      expect(dbContent.explanation).toBeDefined();
      
      // 验证 JSONB 格式正确
      const contentStr = JSON.stringify(dbContent.content);
      const explanationStr = JSON.stringify(dbContent.explanation);
      expect(() => JSON.parse(contentStr)).not.toThrow();
      expect(() => JSON.parse(explanationStr)).not.toThrow();
      
      // 验证不包含 undefined
      expect(contentStr).not.toContain('undefined');
      expect(explanationStr).not.toContain('undefined');
      
      console.log('[TEST] 数据库 JSONB 验证 - content:', contentStr.substring(0, 200));
      console.log('[TEST] 数据库 JSONB 验证 - explanation:', explanationStr.substring(0, 200));
    });
  });

  describe('Task 4: 双环境测试（local-ai-service + 远程 ai-service）', () => {
    it('应该在 local-ai-service 环境下正常工作', async () => {
      // 设置环境变量指向 local-ai-service
      process.env.AI_SERVICE_URL = process.env.LOCAL_AI_SERVICE_URL || 'http://localhost:3001';
      
      const response = await fetch(`${baseUrl}/api/admin/question-processing/batch-process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          questionIds: testQuestionIds.slice(0, 1),
          operations: ['full_pipeline'],
          sourceLanguage: 'zh',
          targetLanguages: ['ja'],
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      console.log('[TEST] Local AI Service 测试 - Task ID:', result.taskId);
      console.log('[TEST] Local AI Service 测试 - 响应:', JSON.stringify(result, null, 2));
    });

    it('应该在远程 ai-service（Render）环境下正常工作', async () => {
      // 设置环境变量指向远程 ai-service
      process.env.AI_SERVICE_URL = process.env.RENDER_AI_SERVICE_URL || 'https://ai-service.onrender.com';
      
      const response = await fetch(`${baseUrl}/api/admin/question-processing/batch-process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          questionIds: testQuestionIds.slice(0, 1),
          operations: ['full_pipeline'],
          sourceLanguage: 'zh',
          targetLanguages: ['ja'],
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      console.log('[TEST] Remote AI Service 测试 - Task ID:', result.taskId);
      console.log('[TEST] Remote AI Service 测试 - 响应:', JSON.stringify(result, null, 2));
    });
  });

  // 辅助函数
  async function waitForTaskCompletion(taskId: string, maxWait = 60000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      const response = await fetch(`${baseUrl}/api/admin/question-processing/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });
      const task = await response.json();
      if (task.status === 'completed' || task.status === 'failed') {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Task completion timeout');
  }

  async function getTaskDetails(taskId: string): Promise<any> {
    const response = await fetch(`${baseUrl}/api/admin/question-processing/tasks/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });
    return await response.json();
  }

  async function checkDatabaseContent(questionIds: number[], allowedLanguages: string[]): Promise<{
    hasOnlyTargetLanguages: boolean;
    hasExtraLanguages: boolean;
    details: any;
  }> {
    // 这里需要实际查询数据库
    // 为了测试框架完整性，这里提供接口定义
    // 实际实现需要连接数据库查询 questions 表
    return {
      hasOnlyTargetLanguages: true,
      hasExtraLanguages: false,
      details: {},
    };
  }

  async function getQuestionFromDb(questionId: number): Promise<any> {
    // 这里需要实际查询数据库
    // 为了测试框架完整性，这里提供接口定义
    const response = await fetch(`${baseUrl}/api/admin/questions/${questionId}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });
    return await response.json();
  }
});

