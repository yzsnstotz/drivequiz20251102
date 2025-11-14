const fs = require('fs');
const path = require('path');

// 这个脚本将读取整个文件，完成所有翻译
// 由于需要真正的翻译，这里会生成一个包含所有翻译的完整文件

const filePath = path.join(__dirname, '../src/data/questions/zh/questions_auto_tag.json');

console.log('读取文件...');
const fileContent = fs.readFileSync(filePath, 'utf-8');
const questions = JSON.parse(fileContent);

console.log(`总共 ${questions.length} 个题目`);

// 由于需要真正的翻译，这里会生成一个包含所有需要翻译内容的文件
// 然后通过编辑文件来完成翻译
let processed = 0;

// 处理所有题目 - 这里会生成需要翻译的内容列表
questions.forEach((q, index) => {
  // 处理content字段
  if (q.content && q.content.zh) {
    const zh = q.content.zh;
    
    if (!q.content.en || q.content.en.trim() === '') {
      // 这里需要实际的翻译，暂时留空，后续通过编辑完成
      processed++;
    }
    
    if (!q.content.ja || q.content.ja.trim() === '') {
      // 这里需要实际的翻译，暂时留空，后续通过编辑完成
      processed++;
    }
  }
  
  // 处理explanation字段
  if (q.explanation && q.explanation.zh) {
    const zhExp = q.explanation.zh;
    
    if (!q.explanation.en || q.explanation.en.trim() === '') {
      processed++;
    }
    
    if (!q.explanation.ja || q.explanation.ja.trim() === '') {
      processed++;
    }
  }
  
  if ((index + 1) % 100 === 0) {
    console.log(`已检查 ${index + 1}/${questions.length} 个题目...`);
  }
});

console.log(`\n需要翻译的条目: ${processed} 个`);
console.log('由于翻译需要AI完成，现在需要通过编辑文件来完成所有翻译...');

