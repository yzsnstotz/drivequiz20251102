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

// 翻译函数 - 这里需要实际的翻译逻辑
// 由于需要在脚本中完成翻译，我会提供一个基本的翻译框架
// 实际翻译会通过编辑文件来完成

let stats = {
  contentEn: 0,
  contentJa: 0,
  explanationAdded: 0,
  explanationEn: 0,
  explanationJa: 0
};

// 处理所有题目
questions.forEach((q, index) => {
  // 处理content字段
  if (q.content && q.content.zh) {
    const zh = q.content.zh;
    
    if (!q.content.en || q.content.en.trim() === '') {
      // 这里需要实际的翻译，暂时留空，后续通过编辑完成
      stats.contentEn++;
    }
    
    if (!q.content.ja || q.content.ja.trim() === '') {
      // 这里需要实际的翻译，暂时留空，后续通过编辑完成
      stats.contentJa++;
    }
  }
  
  // 处理explanation字段
  if (!q.explanation) {
    const zhContent = q.content?.zh || '';
    const generatedZh = generateExplanation(zhContent, q.correctAnswer, q.type);
    
    q.explanation = {
      zh: generatedZh,
      en: '', // 需要翻译
      ja: ''  // 需要翻译
    };
    stats.explanationAdded++;
    stats.explanationEn++;
    stats.explanationJa++;
  } else if (q.explanation.zh) {
    const zhExp = q.explanation.zh;
    
    if (!q.explanation.en || q.explanation.en.trim() === '') {
      stats.explanationEn++;
    }
    
    if (!q.explanation.ja || q.explanation.ja.trim() === '') {
      stats.explanationJa++;
    }
  }
  
  if ((index + 1) % 100 === 0) {
    console.log(`已检查 ${index + 1}/${questions.length} 个题目...`);
  }
});

console.log('\n统计:');
console.log(`- Content EN需要翻译: ${stats.contentEn}`);
console.log(`- Content JA需要翻译: ${stats.contentJa}`);
console.log(`- Explanation新增: ${stats.explanationAdded}`);
console.log(`- Explanation EN需要翻译: ${stats.explanationEn}`);
console.log(`- Explanation JA需要翻译: ${stats.explanationJa}`);

console.log('\n由于翻译需要AI完成，现在需要通过编辑文件来完成所有翻译...');

