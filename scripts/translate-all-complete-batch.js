const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/data/questions/zh/questions_auto_tag.json');

console.log('读取文件...');
const fileContent = fs.readFileSync(filePath, 'utf-8');
const questions = JSON.parse(fileContent);

console.log(`总共 ${questions.length} 个题目`);

// 处理所有题目
let processed = 0;
let contentEnProcessed = 0;
let contentJaProcessed = 0;
let explanationEnProcessed = 0;
let explanationJaProcessed = 0;

questions.forEach((q, index) => {
  // 处理content字段
  if (q.content && q.content.zh) {
    const zh = q.content.zh;
    
    // 翻译en
    if (!q.content.en || q.content.en.trim() === '') {
      // 这里需要实际的翻译，暂时标记
      q.content.en = `[NEEDS_TRANSLATION_EN]${zh}`;
      contentEnProcessed++;
    }
    
    // 翻译ja
    if (!q.content.ja || q.content.ja.trim() === '') {
      // 这里需要实际的翻译，暂时标记
      q.content.ja = `[NEEDS_TRANSLATION_JA]${zh}`;
      contentJaProcessed++;
    }
  }
  
  // 处理explanation字段
  if (q.explanation && q.explanation.zh) {
    const zhExp = q.explanation.zh;
    
    // 翻译en
    if (!q.explanation.en || q.explanation.en.trim() === '') {
      // 这里需要实际的翻译，暂时标记
      q.explanation.en = `[NEEDS_TRANSLATION_EN]${zhExp}`;
      explanationEnProcessed++;
    }
    
    // 翻译ja
    if (!q.explanation.ja || q.explanation.ja.trim() === '') {
      // 这里需要实际的翻译，暂时标记
      q.explanation.ja = `[NEEDS_TRANSLATION_JA]${zhExp}`;
      explanationJaProcessed++;
    }
  }
  
  if ((index + 1) % 100 === 0) {
    console.log(`已处理 ${index + 1}/${questions.length} 个题目...`);
  }
});

console.log('\n统计:');
console.log(`- Content EN需要翻译: ${contentEnProcessed}`);
console.log(`- Content JA需要翻译: ${contentJaProcessed}`);
console.log(`- Explanation EN需要翻译: ${explanationEnProcessed}`);
console.log(`- Explanation JA需要翻译: ${explanationJaProcessed}`);
console.log(`- 总共需要翻译: ${contentEnProcessed + contentJaProcessed + explanationEnProcessed + explanationJaProcessed} 个`);

// 保存文件（带标记）
fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), 'utf-8');
console.log('\n已保存文件（带翻译标记）');
console.log('现在需要通过编辑文件来完成所有翻译...');

