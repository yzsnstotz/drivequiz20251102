#!/usr/bin/env tsx

/**
 * 检查 ai_logs 表的实际结构
 */

import { aiDb } from '../src/lib/aiDb';

async function checkTableStructure() {
  console.log('🔍 检查 ai_logs 表结构');
  console.log('========================');

  try {
    // 检查表是否存在和字段结构
    console.log('1. 检查 ai_logs 表是否存在和字段结构...');

    // 使用简单的查询来检查表和字段
    const tableCheck = await aiDb
      .selectFrom('ai_logs')
      .select('id')
      .limit(1)
      .execute();

    console.log('✅ ai_logs 表存在，可以查询');

    // 检查最近的记录以了解字段
    console.log('\n2. 检查最近的记录...');
    const recentRecords = await aiDb
      .selectFrom('ai_logs')
      .select(['id', 'user_id', 'question', 'answer', 'from', 'locale', 'model', 'created_at'])
      .orderBy('created_at', 'desc')
      .limit(2)
      .execute();

    console.log('最近的记录字段示例:');
    if (recentRecords.length > 0) {
      const record = recentRecords[0];
      console.log('字段列表:', Object.keys(record));
      console.log('示例记录:', {
        id: record.id,
        user_id: record.user_id,
        question: record.question?.substring(0, 30) + '...',
        from: record.from,
        locale: record.locale,
        model: record.model,
        created_at: record.created_at,
      });
    } else {
      console.log('表为空，没有示例记录');
    }

    // 测试插入一条记录
    console.log('\n4. 测试插入记录...');
    const testId = Date.now().toString();
    await aiDb
      .insertInto('ai_logs')
      .values({
        user_id: `test-${testId}`,
        question: `测试问题 ${testId}`,
        answer: `测试回答 ${testId}`,
        from: 'chat',
        locale: 'zh',
        model: 'gpt-4o-mini',
        rag_hits: 0,
        safety_flag: 'ok',
        cost_est: null,
        sources: null,
        ai_provider: 'openai',
        cached: false,
        created_at: new Date(),
      })
      .execute();

    console.log('✅ 测试插入成功');

    // 验证插入
    console.log('\n5. 验证插入结果...');
    const inserted = await aiDb
      .selectFrom('ai_logs')
      .where('user_id', '=', `test-${testId}`)
      .select(['id', 'user_id', 'question', 'from', 'created_at'])
      .executeTakeFirst();

    if (inserted) {
      console.log('✅ 验证成功:', {
        id: inserted.id,
        user_id: inserted.user_id,
        question: inserted.question,
        from: inserted.from,
        created_at: inserted.created_at,
      });

      // 清理测试数据
      await aiDb
        .deleteFrom('ai_logs')
        .where('id', '=', inserted.id!)
        .execute();

      console.log('✅ 测试数据已清理');
    } else {
      console.log('❌ 验证失败：未找到插入的记录');
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  checkTableStructure().catch(console.error);
}

export { checkTableStructure };
