const fs = require('fs');
const path = require('path');

// 读取文件
const filePath = path.join(__dirname, '../src/data/questions/zh/questions_auto_tag.json');
console.log('正在读取文件...');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log(`总共 ${data.length} 个问题`);

// 翻译函数 - 这些将由AI助手完成
// 这里我们创建一个占位符，实际翻译将在处理时完成
function translateToEnglish(zhText) {
  // 这个函数将在实际处理时由AI完成翻译
  // 现在返回空字符串作为占位符
  return '';
}

function translateToJapanese(zhText) {
  // 这个函数将在实际处理时由AI完成翻译
  // 现在返回空字符串作为占位符
  return '';
}

// 处理所有需要翻译的条目
let processed = 0;
let totalFields = 0;

data.forEach((question, index) => {
  let updated = false;
  
  // 处理 content.en
  if (!question.content.en || question.content.en.trim() === '') {
    question.content.en = translateToEnglish(question.content.zh);
    updated = true;
    totalFields++;
  }
  
  // 处理 content.ja
  if (!question.content.ja || question.content.ja.trim() === '') {
    question.content.ja = translateToJapanese(question.content.zh);
    updated = true;
    totalFields++;
  }
  
  // 处理 explanation
  if (question.explanation) {
    if (!question.explanation.en || question.explanation.en.trim() === '') {
      question.explanation.en = translateToEnglish(question.explanation.zh);
      updated = true;
      totalFields++;
    }
    
    if (!question.explanation.ja || question.explanation.ja.trim() === '') {
      question.explanation.ja = translateToJapanese(question.explanation.zh);
      updated = true;
      totalFields++;
    }
  }
  
  if (updated) {
    processed++;
    if (processed % 100 === 0) {
      console.log(`已处理 ${processed} 个条目...`);
    }
  }
});

console.log(`\n处理完成:`);
console.log(`  - 处理了 ${processed} 个条目`);
console.log(`  - 翻译了 ${totalFields} 个字段`);

// 保存更新后的文件
console.log('\n正在保存文件...');
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log('文件已保存！');


