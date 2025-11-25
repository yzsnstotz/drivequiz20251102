const fs = require('fs');
const path = require('path');

// 这个脚本将完成所有翻译
// 由于任务量大，我们将使用Node.js处理

const filePath = path.join(__dirname, '../src/data/questions/zh/questions_auto_tag.json');

console.log('正在读取文件...');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log(`总共 ${data.length} 个问题`);

// 找出所有需要翻译的条目并完成翻译
let processed = 0;
let totalFields = 0;

// 翻译映射 - 这里将存储所有翻译结果
// 由于任务量大，我们将分批处理
const translationMap = new Map();

data.forEach((question, index) => {
  let updated = false;
  
  // 处理 content.en
  if (!question.content.en || question.content.en.trim() === '') {
    const key = `${index}_content_en`;
    translationMap.set(key, {
      index,
      type: 'content',
      lang: 'en',
      zh: question.content.zh
    });
    updated = true;
    totalFields++;
  }
  
  // 处理 content.ja
  if (!question.content.ja || question.content.ja.trim() === '') {
    const key = `${index}_content_ja`;
    translationMap.set(key, {
      index,
      type: 'content',
      lang: 'ja',
      zh: question.content.zh
    });
    updated = true;
    totalFields++;
  }
  
  // 处理 explanation
  if (question.explanation) {
    if (!question.explanation.en || question.explanation.en.trim() === '') {
      const key = `${index}_explanation_en`;
      translationMap.set(key, {
        index,
        type: 'explanation',
        lang: 'en',
        zh: question.explanation.zh
      });
      updated = true;
      totalFields++;
    }
    
    if (!question.explanation.ja || question.explanation.ja.trim() === '') {
      const key = `${index}_explanation_ja`;
      translationMap.set(key, {
        index,
        type: 'explanation',
        lang: 'ja',
        zh: question.explanation.zh
      });
      updated = true;
      totalFields++;
    }
  }
  
  if (updated) {
    processed++;
  }
});

console.log(`需要处理 ${processed} 个条目，共 ${totalFields} 个字段`);

// 导出翻译任务
const tasks = Array.from(translationMap.values());
const tasksPath = path.join(__dirname, 'all-translation-tasks.json');
fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2), 'utf8');
console.log(`\n翻译任务已保存到: ${tasksPath}`);
console.log(`\n前10个翻译任务:`);
tasks.slice(0, 10).forEach((task, i) => {
  console.log(`${i + 1}. Index ${task.index}, ${task.type}.${task.lang}: ${task.zh.substring(0, 60)}...`);
});


