const fs = require('fs');
const path = require('path');

// 读取原始文件
const filePath = path.join(__dirname, '../src/data/questions/zh/questions_auto_tag.json');
console.log('正在读取文件...');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log(`总共 ${data.length} 个问题`);

// 翻译函数 - 这些将由AI助手在运行时完成
// 由于文件很大，我们将使用一个翻译映射对象
// 这个对象将在处理过程中逐步填充

// 读取需要翻译的数据
const needsTranslationPath = path.join(__dirname, 'needs-translation.json');
const needsTranslation = JSON.parse(fs.readFileSync(needsTranslationPath, 'utf8'));

console.log(`需要翻译 ${needsTranslation.length} 个条目`);

// 创建一个翻译映射，key是index，value是翻译结果
const translations = {};

// 处理每个需要翻译的条目
needsTranslation.forEach((item, idx) => {
  if (idx % 100 === 0) {
    console.log(`处理进度: ${idx}/${needsTranslation.length}`);
  }
  
  const trans = {
    index: item.index,
    id: item.id,
  };
  
  // 翻译 content.en
  if (item.contentEn) {
    // 这里将由AI完成翻译
    trans.contentEn = ''; // 占位符
  }
  
  // 翻译 content.ja
  if (item.contentJa) {
    // 这里将由AI完成翻译
    trans.contentJa = ''; // 占位符
  }
  
  // 翻译 explanation.en
  if (item.explanationEn && item.explanationZh) {
    // 这里将由AI完成翻译
    trans.explanationEn = ''; // 占位符
  }
  
  // 翻译 explanation.ja
  if (item.explanationJa && item.explanationZh) {
    // 这里将由AI完成翻译
    trans.explanationJa = ''; // 占位符
  }
  
  translations[item.index] = trans;
});

// 应用翻译到数据
console.log('\n正在应用翻译...');
let applied = 0;

needsTranslation.forEach((item) => {
  const question = data[item.index];
  const trans = translations[item.index];
  
  if (item.contentEn && trans.contentEn) {
    question.content.en = trans.contentEn;
    applied++;
  }
  
  if (item.contentJa && trans.contentJa) {
    question.content.ja = trans.contentJa;
    applied++;
  }
  
  if (item.explanationEn && item.explanationZh && trans.explanationEn) {
    question.explanation.en = trans.explanationEn;
    applied++;
  }
  
  if (item.explanationJa && item.explanationZh && trans.explanationJa) {
    question.explanation.ja = trans.explanationJa;
    applied++;
  }
});

console.log(`应用了 ${applied} 个翻译`);

// 保存文件
console.log('\n正在保存文件...');
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log('完成！');


