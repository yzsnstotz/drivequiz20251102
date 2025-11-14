// 翻译所有问题的内容
const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.resolve(__dirname, '../src/data/questions/zh/questions_auto_tag.json');

// 读取文件
console.log('读取文件...');
const content = fs.readFileSync(INPUT_FILE, 'utf-8');
const questions = JSON.parse(content);
console.log(`读取到 ${questions.length} 个问题`);

// 统计需要翻译的问题
let translated = 0;
let needsTranslation = 0;

questions.forEach((q, i) => {
  if (q.content.en.startsWith('[EN]') || q.content.ja.startsWith('[JA]')) {
    needsTranslation++;
  }
  if (q.explanation && (q.explanation.en.startsWith('[EN]') || q.explanation.ja.startsWith('[JA]'))) {
    needsTranslation++;
  }
  if (!q.content.en.startsWith('[EN]') && !q.content.ja.startsWith('[JA]')) {
    translated++;
  }
});

console.log(`需要翻译: ${needsTranslation} 个字段`);
console.log(`已翻译: ${translated} 个问题`);

// 这里需要实际的翻译逻辑
// 由于文件很大，我们需要使用实际的翻译服务
console.log('\n注意：需要实际的翻译逻辑来替换占位符');
console.log('文件格式已转换完成，现在需要实际的翻译');

