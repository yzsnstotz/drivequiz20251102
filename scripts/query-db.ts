import { db } from '../src/lib/db';

/**
 * 查询激活码数据
 */
async function queryActivationCodes() {
  try {
    console.log('🔍 正在查询激活码数据...\n');

    // 1. 查询所有激活码（限制100条）
    const codes = await db
      .selectFrom('activation_codes')
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(100)
      .execute();

    console.log('📋 激活码列表（最近100条）:');
    console.table(codes.slice(0, 20)); // 只显示前20条
    
    if (codes.length > 20) {
      console.log(`\n... 还有 ${codes.length - 20} 条记录未显示`);
    }

    // 2. 统计信息
    const stats = await db
      .selectFrom('activation_codes')
      .select([
        db.fn.count('id').as('total'),
        db.fn.count('id').filterWhere('is_used', '=', false).as('unused'),
        db.fn.count('id').filterWhere('is_used', '=', true).as('used')
      ])
      .executeTakeFirst();

    console.log('\n📊 统计信息:');
    console.log({
      '总数': stats?.total || 0,
      '未使用': stats?.unused || 0,
      '已使用': stats?.used || 0,
      '使用率': stats?.total 
        ? `${((stats.used / stats.total) * 100).toFixed(2)}%` 
        : '0%'
    });

    // 3. 查询激活记录（最近10条）
    const activations = await db
      .selectFrom('activations')
      .selectAll()
      .orderBy('activated_at', 'desc')
      .limit(10)
      .execute();

    console.log('\n📝 最近10条激活记录:');
    console.table(activations.map(act => ({
      id: act.id,
      email: act.email,
      code: act.activation_code,
      ip: act.ip_address,
      time: act.activated_at?.toLocaleString('zh-CN')
    })));

    // 4. 按日期统计激活记录
    const dailyStats = await db
      .selectFrom('activations')
      .select([
        db.fn.count('id').as('count'),
        db.fn.date('activated_at').as('date')
      ])
      .groupBy('date')
      .orderBy('date', 'desc')
      .limit(7)
      .execute();

    console.log('\n📅 最近7天激活统计:');
    console.table(dailyStats);

  } catch (error) {
    console.error('❌ 查询失败:', error);
    if (error instanceof Error) {
      console.error('错误信息:', error.message);
    }
  } finally {
    await db.destroy();
  }
}

/**
 * 查询特定激活码的信息
 */
async function querySpecificCode(code: string) {
  try {
    console.log(`🔍 正在查询激活码: ${code}\n`);

    const codeInfo = await db
      .selectFrom('activation_codes')
      .selectAll()
      .where('code', '=', code)
      .executeTakeFirst();

    if (!codeInfo) {
      console.log('❌ 未找到该激活码');
      return;
    }

    console.log('📋 激活码信息:');
    console.table([codeInfo]);

    // 查询该激活码的所有激活记录
    const activations = await db
      .selectFrom('activations')
      .selectAll()
      .where('activation_code', '=', code)
      .orderBy('activated_at', 'desc')
      .execute();

    console.log(`\n📝 激活记录 (${activations.length} 条):`);
    if (activations.length > 0) {
      console.table(activations.map(act => ({
        id: act.id,
        email: act.email,
        ip: act.ip_address,
        time: act.activated_at?.toLocaleString('zh-CN')
      })));
    } else {
      console.log('  暂无激活记录');
    }

  } catch (error) {
    console.error('❌ 查询失败:', error);
  } finally {
    await db.destroy();
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // 如果提供了激活码参数，查询特定激活码
    await querySpecificCode(args[0]);
  } else {
    // 否则查询所有数据
    await queryActivationCodes();
  }
}

main();

