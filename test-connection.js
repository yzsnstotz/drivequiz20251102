require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

console.log('🔍 检查环境变量...');
console.log('DATABASE_URL exists:', !!connectionString);
if (connectionString) {
  console.log('DATABASE_URL (first 50 chars):', connectionString.substring(0, 50) + '...');
  console.log('Contains supabase.com:', connectionString.includes('supabase.com'));
  console.log('Contains sslmode=require:', connectionString.includes('sslmode=require'));
}

if (!connectionString) {
  console.error('❌ DATABASE_URL 未设置！');
  console.error('请检查 .env.local 文件是否存在且包含 DATABASE_URL');
  process.exit(1);
}

const isSupabase = connectionString.includes('supabase.com') || connectionString.includes('sslmode=require');

console.log('\n🔄 正在测试数据库连接...');
const pool = new Pool({
  connectionString,
  ssl: isSupabase ? {
    rejectUnauthorized: false,
  } : false,
});

pool.connect()
  .then(async (client) => {
    try {
      console.log('✅ 数据库连接成功！');
      
      // 测试查询
      const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
      console.log('✅ 查询成功:');
      console.log('   - 当前时间:', result.rows[0].current_time);
      console.log('   - PostgreSQL 版本:', result.rows[0].pg_version.substring(0, 50) + '...');
      
      // 检查表是否存在
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      
      console.log('\n📊 数据库中的表:');
      if (tablesResult.rows.length === 0) {
        console.log('   ⚠️  没有找到任何表（可能需要初始化数据库）');
      } else {
        tablesResult.rows.forEach(row => {
          console.log('   -', row.table_name);
        });
      }
      
      client.release();
      await pool.end();
      console.log('\n✅ 所有测试通过！');
      process.exit(0);
    } catch (queryError) {
      console.error('❌ 查询失败:', queryError.message);
      client.release();
      await pool.end();
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ 连接失败:');
    console.error('   错误消息:', error.message);
    console.error('   错误代码:', error.code);
    console.error('\n可能的原因:');
    console.error('   1. 数据库密码错误');
    console.error('   2. 数据库主机地址错误');
    console.error('   3. 网络连接问题');
    console.error('   4. SSL 配置问题');
    console.error('\n请检查:');
    console.error('   - .env.local 文件中的 DATABASE_URL 是否正确');
    console.error('   - Supabase 项目是否正常运行');
    console.error('   - 防火墙/网络是否允许连接');
    pool.end();
    process.exit(1);
  });

