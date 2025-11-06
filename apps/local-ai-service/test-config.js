// 测试配置脚本
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

console.log('='.repeat(60));
console.log('🔍 检查本地AI服务配置');
console.log('='.repeat(60));
console.log();

console.log('📋 配置状态:');
console.log(`   SUPABASE_URL: ${SUPABASE_URL ? '✅ ' + SUPABASE_URL : '❌ 未配置'}`);
console.log(`   SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY ? (SUPABASE_SERVICE_KEY === 'your_service_key' ? '⚠️  需要配置（当前为占位符）' : '✅ 已配置（长度: ' + SUPABASE_SERVICE_KEY.length + '）') : '❌ 未配置'}`);
console.log();

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY === 'your_service_key') {
  console.log('❌ 配置不完整！');
  console.log();
  console.log('📝 请执行以下步骤：');
  console.log('1. 登录 Supabase Dashboard: https://app.supabase.com');
  console.log('2. 选择项目: zalem-ai-service (ID: cgpmpfnjzlzbquakmmrj)');
  console.log('3. 进入 Settings -> API');
  console.log('4. 复制 service_role key（不是 anon key）');
  console.log('5. 更新 apps/local-ai-service/.env.local 中的 SUPABASE_SERVICE_KEY');
  console.log();
  process.exit(1);
} else {
  console.log('✅ 配置完整！');
  console.log();
  console.log('🚀 可以启动服务了：');
  console.log('   cd apps/local-ai-service && npm run dev');
}
