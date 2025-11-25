const fs = require('fs');
const path = require('path');

// 这个脚本将处理所有翻译任务
// 由于文件很大，我会分批处理并定期保存备份

const filePath = path.join(__dirname, '../src/data/questions/zh/questions_auto_tag.json');
const backupPath = filePath + '.backup.' + Date.now();

console.log('创建备份...');
fs.copyFileSync(filePath, backupPath);
console.log(`备份已创建: ${backupPath}`);

console.log('读取文件...');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

console.log(`总共 ${data.length} 个问题`);

// 生成解释的函数
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

// 翻译函数 - 这些将在实际处理时由AI完成
// 这里先创建占位符结构

let stats = {
  contentTranslated: 0,
  explanationAdded: 0,
  explanationTranslated: 0,
  totalProcessed: 0
};

// 处理函数 - 将在后续步骤中完成实际翻译
function processQuestion(question, index) {
  let updated = false;
  
  // 处理 content 翻译
  if (!question.content.en || question.content.en === '') {
    // 需要翻译 - 将在后续步骤中完成
    updated = true;
  }
  
  if (!question.content.ja || question.content.ja === '') {
    // 需要翻译 - 将在后续步骤中完成
    updated = true;
  }
  
  // 处理 explanation
  if (!question.explanation) {
    const zhExplanation = generateExplanation(question);
    question.explanation = {
      zh: zhExplanation,
      en: '',
      ja: ''
    };
    stats.explanationAdded++;
    updated = true;
  } else {
    if (!question.explanation.zh || question.explanation.zh === '') {
      const zhExplanation = generateExplanation(question);
      question.explanation.zh = zhExplanation;
      updated = true;
    }
    if (!question.explanation.en || question.explanation.en === '') {
      updated = true;
    }
    if (!question.explanation.ja || question.explanation.ja === '') {
      updated = true;
    }
  }
  
  if (updated) {
    stats.totalProcessed++;
  }
  
  return updated;
}

// 先统计需要处理的数量
console.log('统计需要处理的问题...');
data.forEach((q, i) => {
  processQuestion(q, i);
});

console.log('统计结果:');
console.log(`需要处理的问题: ${stats.totalProcessed}`);
console.log(`需要添加 explanation: ${stats.explanationAdded}`);
console.log(`需要翻译 content: ${stats.contentTranslated}`);
console.log(`需要翻译 explanation: ${stats.explanationTranslated}`);

// 导出数据以便后续处理
module.exports = { data, generateExplanation, stats };


