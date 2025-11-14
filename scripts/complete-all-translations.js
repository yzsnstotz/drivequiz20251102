const fs = require('fs');
const path = require('path');

// 翻译映射表 - 这里将存储所有翻译
// 由于文件很大，我们将分批处理并逐步更新文件

const filePath = path.join(__dirname, '../src/data/questions/zh/questions_auto_tag.json');
const backupPath = filePath + '.backup';

// 创建备份
console.log('正在创建备份...');
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(filePath, backupPath);
  console.log('备份已创建');
}

// 读取文件
console.log('正在读取文件...');
const fileContent = fs.readFileSync(filePath, 'utf8');
const data = JSON.parse(fileContent);

console.log(`总共 ${data.length} 个问题`);

// 找出所有需要翻译的条目
const needsTranslation = [];

data.forEach((question, index) => {
  const needs = {
    index,
    id: question.id,
    contentEn: !question.content.en || question.content.en.trim() === '',
    contentJa: !question.content.ja || question.content.ja.trim() === '',
    explanationEn: question.explanation && (!question.explanation.en || question.explanation.en.trim() === ''),
    explanationJa: question.explanation && (!question.explanation.ja || question.explanation.ja.trim() === ''),
  };
  
  if (needs.contentEn || needs.contentJa || needs.explanationEn || needs.explanationJa) {
    needsTranslation.push({
      ...needs,
      question,
    });
  }
});

console.log(`找到 ${needsTranslation.length} 个需要翻译的条目`);
console.log(`需要翻译的字段数: ${needsTranslation.reduce((sum, n) => sum + (n.contentEn ? 1 : 0) + (n.contentJa ? 1 : 0) + (n.explanationEn ? 1 : 0) + (n.explanationJa ? 1 : 0), 0)}`);

// 导出需要翻译的数据，供AI处理
const translationData = needsTranslation.map(item => ({
  index: item.index,
  id: item.id,
  contentZh: item.question.content.zh,
  contentEn: item.contentEn,
  contentJa: item.contentJa,
  explanationZh: item.question.explanation ? item.question.explanation.zh : null,
  explanationEn: item.explanationEn,
  explanationJa: item.explanationJa,
}));

const outputPath = path.join(__dirname, 'needs-translation.json');
fs.writeFileSync(outputPath, JSON.stringify(translationData, null, 2), 'utf8');
console.log(`\n已导出翻译数据到: ${outputPath}`);
console.log(`\n请使用AI助手完成翻译，然后运行 apply-translations.js 来应用翻译`);


