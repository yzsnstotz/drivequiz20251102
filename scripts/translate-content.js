// 翻译文件中的内容，替换占位符
const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.resolve(__dirname, '../src/data/questions/zh/questions_auto_tag.json');
const BATCH_SIZE = 50; // 每批处理的问题数量

// 读取文件
console.log('读取文件...');
const content = fs.readFileSync(INPUT_FILE, 'utf-8');
const questions = JSON.parse(content);
console.log(`读取到 ${questions.length} 个问题`);

// 翻译函数 - 这里需要实际的翻译逻辑
// 由于文件很大，我们需要分批处理
function needsTranslation(q) {
  return q.content.en.startsWith('[EN]') || q.content.ja.startsWith('[JA]') ||
         (q.explanation && (q.explanation.en.startsWith('[EN]') || q.explanation.ja.startsWith('[JA]')));
}

// 统计需要翻译的问题
const needsTranslationCount = questions.filter(needsTranslation).length;
console.log(`需要翻译的问题: ${needsTranslationCount}`);

// 这里我们使用占位符，实际使用时需要替换为真实的翻译API
// 由于文件很大，我们需要分批处理
console.log('注意：此脚本使用占位符，需要实际的翻译逻辑');
console.log('文件格式已转换完成，现在需要实际的翻译来替换占位符');

// 保存当前状态（已经转换格式但需要翻译）
console.log('文件格式已转换完成！');
console.log('下一步：需要实际的翻译来替换占位符');

