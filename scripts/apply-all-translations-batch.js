const fs = require('fs');
const path = require('path');

// 这个脚本将读取整个文件，应用所有翻译
// 由于需要真正的翻译，这里会读取翻译任务文件，然后应用翻译

const filePath = path.join(__dirname, '../src/data/questions/zh/questions_auto_tag.json');
const tasksPath = path.join(__dirname, 'all-needs-translation.json');

console.log('读取文件...');
const fileContent = fs.readFileSync(filePath, 'utf-8');
const questions = JSON.parse(fileContent);

console.log(`总共 ${questions.length} 个题目`);

// 读取翻译任务
let tasks = [];
if (fs.existsSync(tasksPath)) {
  tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
  console.log(`读取到 ${tasks.length} 个翻译任务`);
}

// 处理翻译任务
// 由于需要真正的翻译，这里会标记需要翻译的内容
// 实际翻译会通过编辑文件来完成
let processed = 0;

tasks.forEach((task, index) => {
  const q = questions[task.index];
  
  if (!q) {
    console.log(`警告: 题目索引 ${task.index} 不存在`);
    return;
  }
  
  if (task.type === 'content') {
    if (task.lang === 'en') {
      if (!q.content || !q.content.zh) return;
      // 这里需要实际的翻译，暂时标记
      q.content.en = `[NEEDS_TRANSLATION_EN]${q.content.zh}`;
      processed++;
    } else if (task.lang === 'ja') {
      if (!q.content || !q.content.zh) return;
      // 这里需要实际的翻译，暂时标记
      q.content.ja = `[NEEDS_TRANSLATION_JA]${q.content.zh}`;
      processed++;
    }
  } else if (task.type === 'explanation') {
    if (task.lang === 'en') {
      if (!q.explanation || !q.explanation.zh) return;
      // 这里需要实际的翻译，暂时标记
      q.explanation.en = `[NEEDS_TRANSLATION_EN]${q.explanation.zh}`;
      processed++;
    } else if (task.lang === 'ja') {
      if (!q.explanation || !q.explanation.zh) return;
      // 这里需要实际的翻译，暂时标记
      q.explanation.ja = `[NEEDS_TRANSLATION_JA]${q.explanation.zh}`;
      processed++;
    }
  }
  
  if ((index + 1) % 100 === 0) {
    console.log(`已处理 ${index + 1}/${tasks.length} 个翻译任务...`);
  }
});

console.log(`\n已处理 ${processed} 个翻译任务`);
console.log('由于翻译需要AI完成，现在需要通过编辑文件来完成所有翻译...');

// 保存文件（带标记）
fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), 'utf-8');
console.log('已保存文件（带翻译标记）');

