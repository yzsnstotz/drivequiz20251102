#!/usr/bin/env tsx

/**
 * 直接测试 insertAiLog 函数
 */

import { aiDb } from '../src/lib/aiDb';

async function testInsertAiLog() {
  console.log('🧪 直接测试 insertAiLog 函数');
  console.log('==============================');

  try {
    // 模拟 insertAiLog 函数的逻辑
    console.log('1. 测试插入聊天记录...');

    const testData = {
      user_id: null, // 模拟未登录用户
      question: "测试问题：你好，请介绍一下日本驾照考试",
      answer: "测试回答：日本驾照考试分为理论考试和实际考试...",
      from: "chat", // scene 映射为 from
      locale: "zh",
      model: "gpt-4o-mini",
      rag_hits: 0,
      safety_flag: "ok",
      cost_est: null,
      sources: null,
      ai_provider: "openai",
      cached: false,
      created_at: new Date(),
    };

    console.log('插入数据:', testData);

    await aiDb
      .insertInto("ai_logs")
      .values(testData)
      .execute();

    console.log('✅ 插入成功');

    // 验证插入结果
    console.log('\n2. 验证插入结果...');

    // 先查看最近的几条记录
    const recentRecords = await aiDb
      .selectFrom('ai_logs')
      .select(['id', 'user_id', 'question', 'answer', 'from', 'locale', 'model', 'created_at'])
      .orderBy('created_at', 'desc')
      .limit(3)
      .execute();

    console.log('最近的记录:');
    recentRecords.forEach((record, index) => {
      console.log(`${index + 1}. ID: ${record.id}, From: ${record.from}, Question: ${record.question?.substring(0, 30)}...`);
    });

    const inserted = await aiDb
      .selectFrom('ai_logs')
      .where('question', '=', testData.question)
      .where('from', '=', 'chat')
      .select(['id', 'user_id', 'question', 'answer', 'from', 'locale', 'model', 'created_at'])
      .orderBy('created_at', 'desc')
      .executeTakeFirst();

    if (!inserted) {
      console.log('⚠️ 未通过精确查询找到记录，可能存在数据库连接问题');
      console.log('检查是否使用了不同的数据库实例');
    }

    console.log('插入的记录:', {
      id: inserted.id,
      user_id: inserted.user_id,
      question: inserted.question?.substring(0, 50) + '...',
      answer: inserted.answer?.substring(0, 50) + '...',
      from: inserted.from,
      locale: inserted.locale,
      model: inserted.model,
      created_at: inserted.created_at,
    });

    // 清理测试数据
    console.log('\n3. 清理测试数据...');
    await aiDb
      .deleteFrom('ai_logs')
      .where('id', '=', inserted.id!)
      .execute();

    console.log('✅ 测试完成，数据已清理');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.log('\n可能的解决方案:');
    console.log('1. 检查数据库字段映射是否正确');
    console.log('2. 检查数据库权限');
    console.log('3. 检查表结构是否匹配');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testInsertAiLog().catch(console.error);
}

export { testInsertAiLog };
