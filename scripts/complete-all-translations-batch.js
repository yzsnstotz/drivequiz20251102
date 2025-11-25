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

// 处理所有题目
let contentEnCount = 0;
let contentJaCount = 0;
let explanationAddedCount = 0;
let explanationEnCount = 0;
let explanationJaCount = 0;

questions.forEach((q, index) => {
  // 处理content字段
  if (q.content && q.content.zh) {
    const zh = q.content.zh;
    
    // 翻译en - 这里需要实际的翻译，暂时标记
    if (!q.content.en || q.content.en.trim() === '') {
      q.content.en = `[NEEDS_TRANSLATION_EN]${zh}`;
      contentEnCount++;
    }
    
    // 翻译ja - 这里需要实际的翻译，暂时标记
    if (!q.content.ja || q.content.ja.trim() === '') {
      q.content.ja = `[NEEDS_TRANSLATION_JA]${zh}`;
      contentJaCount++;
    }
  }
  
  // 处理explanation字段
  if (!q.explanation) {
    // 生成explanation
    const zhContent = q.content?.zh || '';
    const generatedZh = generateExplanation(zhContent, q.correctAnswer, q.type);
    
    q.explanation = {
      zh: generatedZh,
      en: `[NEEDS_TRANSLATION_EN]${generatedZh}`,
      ja: `[NEEDS_TRANSLATION_JA]${generatedZh}`
    };
    explanationAddedCount++;
    explanationEnCount++;
    explanationJaCount++;
  } else if (q.explanation.zh) {
    // 已有explanation，检查翻译
    const zhExp = q.explanation.zh;
    
    if (!q.explanation.en || q.explanation.en.trim() === '') {
      q.explanation.en = `[NEEDS_TRANSLATION_EN]${zhExp}`;
      explanationEnCount++;
    }
    
    if (!q.explanation.ja || q.explanation.ja.trim() === '') {
      q.explanation.ja = `[NEEDS_TRANSLATION_JA]${zhExp}`;
      explanationJaCount++;
    }
  }
  
  if ((index + 1) % 100 === 0) {
    console.log(`已处理 ${index + 1}/${questions.length} 个题目...`);
  }
});

console.log('\n统计:');
console.log(`- Content EN需要翻译: ${contentEnCount}`);
console.log(`- Content JA需要翻译: ${contentJaCount}`);
console.log(`- Explanation新增: ${explanationAddedCount}`);
console.log(`- Explanation EN需要翻译: ${explanationEnCount}`);
console.log(`- Explanation JA需要翻译: ${explanationJaCount}`);

// 保存文件（带标记，后续需要替换）
fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), 'utf-8');
console.log('\n已保存文件（带翻译标记）');
