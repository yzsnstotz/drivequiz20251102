const fs = require('fs');
const path = require('path');

// 这个脚本将读取文件，处理所有条目，完成翻译
// 由于翻译需要AI完成，这里会生成一个包含所有需要翻译内容的文件
// 然后通过编辑来完成翻译

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
let stats = {
  contentEn: 0,
  contentJa: 0,
  explanationAdded: 0,
  explanationEn: 0,
  explanationJa: 0
};

// 由于需要真正的翻译，这里先标记需要翻译的内容
// 然后通过编辑文件来完成翻译
questions.forEach((q, index) => {
  // 处理content字段
  if (q.content && q.content.zh) {
    const zh = q.content.zh;
    
    if (!q.content.en || q.content.en.trim() === '') {
      // 标记需要翻译
      q.content.en = `__TRANSLATE_EN__${zh}__END__`;
      stats.contentEn++;
    }
    
    if (!q.content.ja || q.content.ja.trim() === '') {
      // 标记需要翻译
      q.content.ja = `__TRANSLATE_JA__${zh}__END__`;
      stats.contentJa++;
    }
  }
  
  // 处理explanation字段
  if (!q.explanation) {
    const zhContent = q.content?.zh || '';
    const generatedZh = generateExplanation(zhContent, q.correctAnswer, q.type);
    
    q.explanation = {
      zh: generatedZh,
      en: `__TRANSLATE_EN__${generatedZh}__END__`,
      ja: `__TRANSLATE_JA__${generatedZh}__END__`
    };
    stats.explanationAdded++;
    stats.explanationEn++;
    stats.explanationJa++;
  } else if (q.explanation.zh) {
    const zhExp = q.explanation.zh;
    
    if (!q.explanation.en || q.explanation.en.trim() === '') {
      q.explanation.en = `__TRANSLATE_EN__${zhExp}__END__`;
      stats.explanationEn++;
    }
    
    if (!q.explanation.ja || q.explanation.ja.trim() === '') {
      q.explanation.ja = `__TRANSLATE_JA__${zhExp}__END__`;
      stats.explanationJa++;
    }
  }
  
  if ((index + 1) % 100 === 0) {
    console.log(`已处理 ${index + 1}/${questions.length} 个题目...`);
  }
});

console.log('\n统计:');
console.log(`- Content EN需要翻译: ${stats.contentEn}`);
console.log(`- Content JA需要翻译: ${stats.contentJa}`);
console.log(`- Explanation新增: ${stats.explanationAdded}`);
console.log(`- Explanation EN需要翻译: ${stats.explanationEn}`);
console.log(`- Explanation JA需要翻译: ${stats.explanationJa}`);

// 保存文件（带标记）
fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), 'utf-8');
console.log('\n已保存文件（带翻译标记）');
console.log('现在需要通过编辑来完成所有翻译...');

