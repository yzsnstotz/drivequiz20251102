const fs = require('fs');
const path = require('path');

// 这个脚本将读取文件，找出所有需要翻译的条目
// 然后通过多次编辑来完成翻译

const filePath = path.join(__dirname, '../src/data/questions/zh/questions_auto_tag.json');

console.log('读取文件...');
const fileContent = fs.readFileSync(filePath, 'utf-8');
const questions = JSON.parse(fileContent);

console.log(`总共 ${questions.length} 个题目`);

// 找出所有需要翻译的条目
const needsTranslation = [];

questions.forEach((q, index) => {
  const needs = {
    index,
    id: q.id,
    contentEn: false,
    contentJa: false,
    needsExplanation: false,
    explanationEn: false,
    explanationJa: false
  };
  
  // 检查content翻译
  if (q.content && q.content.zh) {
    if (!q.content.en || q.content.en.trim() === '') {
      needs.contentEn = true;
    }
    if (!q.content.ja || q.content.ja.trim() === '') {
      needs.contentJa = true;
    }
  }
  
  // 检查explanation
  if (!q.explanation) {
    needs.needsExplanation = true;
  } else if (q.explanation.zh) {
    if (!q.explanation.en || q.explanation.en.trim() === '') {
      needs.explanationEn = true;
    }
    if (!q.explanation.ja || q.explanation.ja.trim() === '') {
      needs.explanationJa = true;
    }
  }
  
  if (needs.contentEn || needs.contentJa || needs.needsExplanation || needs.explanationEn || needs.explanationJa) {
    needsTranslation.push(needs);
  }
});

console.log(`需要翻译的题目: ${needsTranslation.length}`);
console.log(`需要content.en翻译: ${needsTranslation.filter(n => n.contentEn).length}`);
console.log(`需要content.ja翻译: ${needsTranslation.filter(n => n.contentJa).length}`);
console.log(`需要添加explanation: ${needsTranslation.filter(n => n.needsExplanation).length}`);
console.log(`需要explanation.en翻译: ${needsTranslation.filter(n => n.explanationEn).length}`);
console.log(`需要explanation.ja翻译: ${needsTranslation.filter(n => n.explanationJa).length}`);

// 保存需要翻译的信息
fs.writeFileSync(
  path.join(__dirname, 'translation-needs.json'),
  JSON.stringify(needsTranslation, null, 2),
  'utf-8'
);

console.log('\n已保存需要翻译的条目信息到 translation-needs.json');

