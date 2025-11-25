// 批量翻译所有剩余的问题
const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.resolve(__dirname, '../src/data/questions/zh/questions_auto_tag.json');
const BATCH_SIZE = 50; // 每批处理的问题数量

// 读取文件
console.log('读取文件...');
const content = fs.readFileSync(INPUT_FILE, 'utf-8');
const questions = JSON.parse(content);
console.log(`读取到 ${questions.length} 个问题`);

// 找出需要翻译的问题
const needsTranslation = questions.filter(q => 
  q.content.en.startsWith('[EN]') || q.content.ja.startsWith('[JA]')
);
console.log(`需要翻译的问题: ${needsTranslation.length}`);

// 翻译函数 - 这里需要实际的翻译逻辑
// 由于文件很大，我们需要分批处理
function translateText(text, targetLang) {
  // 这里需要实际的翻译API调用
  // 暂时返回占位符
  if (targetLang === 'en') {
    return `[EN] ${text}`;
  } else if (targetLang === 'ja') {
    return `[JA] ${text}`;
  }
  return text;
}

// 处理需要翻译的问题
let processed = 0;
for (let i = 0; i < questions.length; i++) {
  const q = questions[i];
  
  // 检查是否需要翻译
  if (q.content.en.startsWith('[EN]') || q.content.ja.startsWith('[JA]')) {
    // 这里需要实际的翻译逻辑
    // 暂时跳过，实际使用时需要调用翻译API
    processed++;
    
    if (processed % 100 === 0) {
      console.log(`已处理 ${processed}/${needsTranslation.length} 个问题`);
    }
  }
}

console.log(`\n注意：此脚本需要实际的翻译逻辑来替换占位符`);
console.log(`文件位置: ${INPUT_FILE}`);
console.log(`需要翻译的问题: ${needsTranslation.length}`);

