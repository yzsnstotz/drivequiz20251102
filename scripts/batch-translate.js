const fs = require('fs');
const path = require('path');

// 这个脚本将批量处理所有翻译
// 由于文件很大，我们将分批处理

const filePath = path.join(__dirname, '../src/data/questions/zh/questions_auto_tag.json');
const needsPath = path.join(__dirname, 'all-translations-needed.json');

console.log('正在读取文件...');
let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const needs = JSON.parse(fs.readFileSync(needsPath, 'utf8'));

console.log(`总共 ${data.length} 个问题`);
console.log(`需要翻译 ${needs.length} 个条目`);

// 翻译函数 - 这些将由AI助手完成
// 由于需要处理大量翻译，我们将使用一个翻译映射

// 创建一个翻译结果数组
// 每个元素包含 index, type, zh, en, ja
const translationTasks = [];

needs.forEach((item) => {
  if (item.contentEn) {
    translationTasks.push({
      index: item.index,
      type: 'content',
      lang: 'en',
      zh: item.contentZh
    });
  }
  
  if (item.contentJa) {
    translationTasks.push({
      index: item.index,
      type: 'content',
      lang: 'ja',
      zh: item.contentZh
    });
  }
  
  if (item.explanationEn && item.explanationZh) {
    translationTasks.push({
      index: item.index,
      type: 'explanation',
      lang: 'en',
      zh: item.explanationZh
    });
  }
  
  if (item.explanationJa && item.explanationZh) {
    translationTasks.push({
      index: item.index,
      type: 'explanation',
      lang: 'ja',
      zh: item.explanationZh
    });
  }
});

console.log(`\n总共需要翻译 ${translationTasks.length} 个字段`);

// 将翻译任务保存到文件，供AI处理
const tasksPath = path.join(__dirname, 'translation-tasks-detailed.json');
fs.writeFileSync(tasksPath, JSON.stringify(translationTasks, null, 2), 'utf8');
console.log(`\n翻译任务已保存到: ${tasksPath}`);
console.log(`\n前10个翻译任务示例:`);
translationTasks.slice(0, 10).forEach((task, i) => {
  console.log(`${i + 1}. Index ${task.index}, ${task.type}.${task.lang}: ${task.zh.substring(0, 60)}...`);
});
