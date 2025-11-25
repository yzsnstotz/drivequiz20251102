const fs = require('fs');
const path = require('path');

// 读取文件
const filePath = path.join(__dirname, '../src/data/questions/zh/questions_auto_tag.json');
console.log('正在读取文件...');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log(`总共 ${data.length} 个问题`);

// 统计需要翻译的数量
let contentEnCount = 0;
let contentJaCount = 0;
let explanationEnCount = 0;
let explanationJaCount = 0;

data.forEach((question) => {
  if (!question.content.en || question.content.en.trim() === '') contentEnCount++;
  if (!question.content.ja || question.content.ja.trim() === '') contentJaCount++;
  if (question.explanation) {
    if (!question.explanation.en || question.explanation.en.trim() === '') explanationEnCount++;
    if (!question.explanation.ja || question.explanation.ja.trim() === '') explanationJaCount++;
  }
});

console.log(`需要翻译的字段:`);
console.log(`  - content.en: ${contentEnCount}`);
console.log(`  - content.ja: ${contentJaCount}`);
console.log(`  - explanation.en: ${explanationEnCount}`);
console.log(`  - explanation.ja: ${explanationJaCount}`);
console.log(`总计: ${contentEnCount + contentJaCount + explanationEnCount + explanationJaCount} 个字段`);

// 输出需要翻译的条目列表（供AI处理）
const needsTranslation = [];

data.forEach((question, index) => {
  const item = {
    index,
    id: question.id,
    translations: []
  };
  
  if (!question.content.en || question.content.en.trim() === '') {
    item.translations.push({
      type: 'content.en',
      zh: question.content.zh
    });
  }
  
  if (!question.content.ja || question.content.ja.trim() === '') {
    item.translations.push({
      type: 'content.ja',
      zh: question.content.zh
    });
  }
  
  if (question.explanation) {
    if (!question.explanation.en || question.explanation.en.trim() === '') {
      item.translations.push({
        type: 'explanation.en',
        zh: question.explanation.zh
      });
    }
    
    if (!question.explanation.ja || question.explanation.ja.trim() === '') {
      item.translations.push({
        type: 'explanation.ja',
        zh: question.explanation.zh
      });
    }
  }
  
  if (item.translations.length > 0) {
    needsTranslation.push(item);
  }
});

console.log(`\n需要翻译的条目数: ${needsTranslation.length}`);

// 将需要翻译的条目保存到文件，供后续处理
const outputPath = path.join(__dirname, 'translation-tasks.json');
fs.writeFileSync(outputPath, JSON.stringify(needsTranslation, null, 2), 'utf8');
console.log(`\n已保存翻译任务到: ${outputPath}`);
console.log(`\n前5个需要翻译的条目示例:`);
needsTranslation.slice(0, 5).forEach((item, i) => {
  console.log(`\n${i + 1}. ID: ${item.id}`);
  item.translations.forEach(t => {
    console.log(`   ${t.type}: ${t.zh.substring(0, 60)}...`);
  });
});
