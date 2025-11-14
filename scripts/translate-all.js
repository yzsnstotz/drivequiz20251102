const fs = require('fs');
const path = require('path');

// 读取文件
const filePath = path.join(__dirname, '../src/data/questions/zh/questions_auto_tag.json');
console.log('正在读取文件...');
let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log(`总共 ${data.length} 个问题`);

// 处理所有需要翻译的条目
let processed = 0;
let totalFields = 0;

// 翻译函数 - 这些函数将在实际处理时由AI完成翻译
// 现在我们先创建一个处理框架

data.forEach((question, index) => {
  let updated = false;
  
  // 处理 content.en
  if (!question.content.en || question.content.en.trim() === '') {
    // 这里需要AI完成翻译
    // question.content.en = translateToEnglish(question.content.zh);
    updated = true;
    totalFields++;
  }
  
  // 处理 content.ja
  if (!question.content.ja || question.content.ja.trim() === '') {
    // 这里需要AI完成翻译
    // question.content.ja = translateToJapanese(question.content.zh);
    updated = true;
    totalFields++;
  }
  
  // 处理 explanation
  if (question.explanation) {
    if (!question.explanation.en || question.explanation.en.trim() === '') {
      // 这里需要AI完成翻译
      // question.explanation.en = translateToEnglish(question.explanation.zh);
      updated = true;
      totalFields++;
    }
    
    if (!question.explanation.ja || question.explanation.ja.trim() === '') {
      // 这里需要AI完成翻译
      // question.explanation.ja = translateToJapanese(question.explanation.zh);
      updated = true;
      totalFields++;
    }
  }
  
  if (updated) {
    processed++;
  }
});

console.log(`需要处理 ${processed} 个条目，共 ${totalFields} 个字段`);

// 由于翻译需要AI完成，我们将分批处理
// 每次处理100个条目
const BATCH_SIZE = 100;
let batchNum = 0;

// 导出第一批需要翻译的数据
const firstBatch = [];
for (let i = 0; i < data.length && firstBatch.length < BATCH_SIZE; i++) {
  const question = data[i];
  const needs = {
    index: i,
    id: question.id,
    contentZh: question.content.zh,
    contentEn: !question.content.en || question.content.en.trim() === '',
    contentJa: !question.content.ja || question.content.ja.trim() === '',
    explanationZh: question.explanation ? question.explanation.zh : null,
    explanationEn: question.explanation && (!question.explanation.en || question.explanation.en.trim() === ''),
    explanationJa: question.explanation && (!question.explanation.ja || question.explanation.ja.trim() === ''),
  };
  
  if (needs.contentEn || needs.contentJa || needs.explanationEn || needs.explanationJa) {
    firstBatch.push(needs);
  }
}

console.log(`\n第一批需要翻译的条目: ${firstBatch.length}`);
const batchPath = path.join(__dirname, `translation-batch-${batchNum}.json`);
fs.writeFileSync(batchPath, JSON.stringify(firstBatch, null, 2), 'utf8');
console.log(`已保存到: ${batchPath}`);
