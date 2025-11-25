const fs = require('fs');
const path = require('path');

// 翻译映射表 - 这里我会在运行时动态翻译
// 由于需要处理大量翻译，我会在循环中逐个处理

function generateExplanation(question) {
  const content = question.content.zh;
  const answer = question.correctAnswer;
  
  if (question.type === 'truefalse') {
    if (answer === 'true') {
      return `正确。${content}`;
    } else {
      return `错误。${content}`;
    }
  } else if (question.type === 'multiplechoice') {
    const correctAnswer = Array.isArray(answer) ? answer[0] : answer;
    return `正确答案是${correctAnswer}。${content}`;
  }
  
  return `根据题目内容：${content}`;
}

// 这个脚本将读取文件，处理所有翻译，然后保存
// 由于翻译量大，我会分批处理并定期保存

const filePath = path.join(__dirname, '../src/data/questions/zh/questions_auto_tag.json');
console.log('读取文件...');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

console.log(`总共 ${data.length} 个问题`);

// 统计需要处理的数量
let needContent = 0;
let needExplanation = 0;
let needExplanationTranslation = 0;

data.forEach(q => {
  if (!q.content.en || q.content.en === '' || !q.content.ja || q.content.ja === '') {
    needContent++;
  }
  if (!q.explanation) {
    needExplanation++;
  } else if (!q.explanation.en || q.explanation.en === '' || !q.explanation.ja || q.explanation.ja === '') {
    needExplanationTranslation++;
  }
});

console.log(`需要翻译 content: ${needContent}`);
console.log(`需要添加 explanation: ${needExplanation}`);
console.log(`需要翻译 explanation: ${needExplanationTranslation}`);

// 导出数据以便后续处理
module.exports = { data, generateExplanation };
