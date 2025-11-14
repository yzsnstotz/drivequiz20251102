const fs = require('fs');
const path = require('path');

// 这个脚本将读取整个文件，完成所有翻译
// 由于需要真正的翻译，这里会生成一个包含所有翻译的完整文件

const filePath = path.join(__dirname, '../src/data/questions/zh/questions_auto_tag.json');

console.log('读取文件...');
const fileContent = fs.readFileSync(filePath, 'utf-8');
const questions = JSON.parse(fileContent);

console.log(`总共 ${questions.length} 个题目`);

// 处理所有题目
let stats = {
  contentEn: 0,
  contentJa: 0,
  explanationEn: 0,
  explanationJa: 0
};

// 收集所有需要翻译的内容
const needsTranslation = [];

questions.forEach((q, index) => {
  // 处理content字段
  if (q.content && q.content.zh) {
    if (!q.content.en || q.content.en.trim() === '') {
      needsTranslation.push({
        type: 'content',
        lang: 'en',
        index,
        id: q.id,
        zh: q.content.zh
      });
      stats.contentEn++;
    }
    
    if (!q.content.ja || q.content.ja.trim() === '') {
      needsTranslation.push({
        type: 'content',
        lang: 'ja',
        index,
        id: q.id,
        zh: q.content.zh
      });
      stats.contentJa++;
    }
  }
  
  // 处理explanation字段
  if (q.explanation && q.explanation.zh) {
    if (!q.explanation.en || q.explanation.en.trim() === '') {
      needsTranslation.push({
        type: 'explanation',
        lang: 'en',
        index,
        id: q.id,
        zh: q.explanation.zh
      });
      stats.explanationEn++;
    }
    
    if (!q.explanation.ja || q.explanation.ja.trim() === '') {
      needsTranslation.push({
        type: 'explanation',
        lang: 'ja',
        index,
        id: q.id,
        zh: q.explanation.zh
      });
      stats.explanationJa++;
    }
  }
  
  if ((index + 1) % 100 === 0) {
    console.log(`已检查 ${index + 1}/${questions.length} 个题目...`);
  }
});

console.log('\n统计:');
console.log(`- Content EN需要翻译: ${stats.contentEn}`);
console.log(`- Content JA需要翻译: ${stats.contentJa}`);
console.log(`- Explanation EN需要翻译: ${stats.explanationEn}`);
console.log(`- Explanation JA需要翻译: ${stats.explanationJa}`);
console.log(`- 总共需要翻译: ${needsTranslation.length} 个`);

// 保存需要翻译的内容列表
fs.writeFileSync(
  path.join(__dirname, 'all-needs-translation.json'),
  JSON.stringify(needsTranslation, null, 2),
  'utf-8'
);

console.log('\n已保存需要翻译的内容到 all-needs-translation.json');
console.log('现在需要通过编辑文件来完成所有翻译...');

