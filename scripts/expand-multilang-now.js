// 直接处理文件，扩展为多语言格式
const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.resolve(__dirname, '../src/data/questions/zh/questions_auto_tag.json');

// 读取文件
console.log('读取文件...');
const content = fs.readFileSync(INPUT_FILE, 'utf-8');
const questions = JSON.parse(content);
console.log(`读取到 ${questions.length} 个问题`);

// 处理每个问题，转换为多语言格式
const multilangQuestions = questions.map((q, index) => {
  if ((index + 1) % 100 === 0) {
    console.log(`处理进度: ${index + 1}/${questions.length}`);
  }
  
  // 这里需要实际的翻译逻辑
  // 暂时使用占位符，实际使用时需要替换为真实的翻译
  const multilangQ = {
    ...q,
    content: {
      zh: q.content,
      en: `[EN] ${q.content}`, // 占位符
      ja: `[JA] ${q.content}`  // 占位符
    }
  };
  
  // 如果有explanation，也转换为多语言格式
  if (q.explanation) {
    multilangQ.explanation = {
      zh: q.explanation,
      en: `[EN] ${q.explanation}`, // 占位符
      ja: `[JA] ${q.explanation}`  // 占位符
    };
  }
  
  return multilangQ;
});

// 保存结果
console.log('保存结果...');
fs.writeFileSync(INPUT_FILE, JSON.stringify(multilangQuestions, null, 2), 'utf-8');
console.log(`完成！共处理 ${multilangQuestions.length} 个问题`);

