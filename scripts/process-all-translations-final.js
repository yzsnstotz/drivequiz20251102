const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/data/questions/zh/questions_auto_tag.json');

console.log('读取文件...');
const fileContent = fs.readFileSync(filePath, 'utf-8');
const questions = JSON.parse(fileContent);

console.log(`总共 ${questions.length} 个题目`);

// 生成explanation的函数
function generateExplanation(content, correctAnswer, type) {
  const zhContent = content.replace(/^\d+[\.、]\s*/, '').trim();
  
  if (type === 'truefalse') {
    if (correctAnswer === 'true') {
      return `根据题目描述，该说法是正确的。${zhContent}`;
    } else {
      return `根据题目描述，该说法是错误的。${zhContent}`;
    }
  } else if (type === 'multiplechoice') {
    return `正确答案是${correctAnswer}。${zhContent}`;
  }
  return `根据题目内容：${zhContent}`;
}

// 处理所有题目 - 这里会生成需要翻译的内容列表
const translationTasks = [];

questions.forEach((q, index) => {
  const task = {
    index,
    id: q.id,
    contentZh: q.content?.zh || '',
    contentEn: q.content?.en || '',
    contentJa: q.content?.ja || '',
    needsContentEn: false,
    needsContentJa: false,
    explanationZh: q.explanation?.zh || '',
    explanationEn: q.explanation?.en || '',
    explanationJa: q.explanation?.ja || '',
    needsExplanation: !q.explanation,
    needsExplanationEn: false,
    needsExplanationJa: false,
    correctAnswer: q.correctAnswer,
    type: q.type
  };
  
  // 检查content翻译
  if (task.contentZh) {
    if (!task.contentEn || task.contentEn.trim() === '') {
      task.needsContentEn = true;
    }
    if (!task.contentJa || task.contentJa.trim() === '') {
      task.needsContentJa = true;
    }
  }
  
  // 检查explanation翻译
  if (task.needsExplanation) {
    task.explanationZh = generateExplanation(task.contentZh, task.correctAnswer, task.type);
    task.needsExplanationEn = true;
    task.needsExplanationJa = true;
  } else if (task.explanationZh) {
    if (!task.explanationEn || task.explanationEn.trim() === '') {
      task.needsExplanationEn = true;
    }
    if (!task.explanationJa || task.explanationJa.trim() === '') {
      task.needsExplanationJa = true;
    }
  }
  
  if (task.needsContentEn || task.needsContentJa || task.needsExplanation || task.needsExplanationEn || task.needsExplanationJa) {
    translationTasks.push(task);
  }
});

console.log(`需要处理的题目: ${translationTasks.length}`);

// 保存翻译任务
fs.writeFileSync(
  path.join(__dirname, 'all-translation-tasks.json'),
  JSON.stringify(translationTasks, null, 2),
  'utf-8'
);

console.log('已保存翻译任务到 all-translation-tasks.json');
console.log('现在需要逐个处理这些翻译任务...');

