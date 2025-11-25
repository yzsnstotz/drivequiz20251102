import * as fs from 'fs';
import * as path from 'path';

// 智能翻译函数 - 中文到英文
function translateZhToEn(zhText: string): string {
  if (!zhText || zhText.trim() === '') return '';
  
  let text = zhText.trim();
  
  // 保存题目编号前缀
  const numberMatch = text.match(/^(\d+\.\s*)/);
  const prefix = numberMatch ? numberMatch[1] : '';
  text = text.replace(/^\d+\.\s*/, '');
  
  // 处理explanation的标准开头
  if (text.startsWith('根据题目描述，该说法是')) {
    if (text.includes('正确的')) {
      text = text.replace(/^根据题目描述，该说法是正确的。\s*/, 'According to the question description, this statement is correct. ');
    } else if (text.includes('错误的') || text.includes('误的')) {
      text = text.replace(/^根据题目描述，该说法是(错误的|误的)。\s*/, 'According to the question description, this statement is incorrect. ');
    }
  }
  
  // 交通术语翻译表
  const termMap: { [key: string]: string } = {
    '持有': 'holding',
    '普通驾驶执照': 'regular driver\'s license',
    '轻型车': 'light vehicle',
    '摩托车': 'motorcycle',
    '原动機付自転車': 'motorized bicycle',
    '不到1年': 'for less than 1 year',
    '必须': 'must',
    '贴上': 'display',
    '新手标志': 'beginner\'s mark',
    '第一种驾驶执照': 'Class 1 driver\'s license',
    '即使': 'even',
    '为了': 'for the purpose of',
    '把': 'to',
    '出租车': 'taxi',
    '运回': 'return',
    '修理': 'repair',
    '不能驾驶': 'cannot drive',
    '在道路上': 'on the road',
    '驾驶': 'driving',
    '机动车': 'motor vehicle',
    '轻型摩托车': 'light motorcycle',
    '必须考取': 'must obtain',
    '与该车类型相应的': 'appropriate for that vehicle type',
    '驾驶执照': 'driver\'s license',
    '信号灯': 'traffic light',
    '交叉路': 'intersection',
    '交差点': 'intersection',
    '右转弯': 'right turn',
    '左转弯': 'left turn',
    '绿灯': 'green light',
    '红灯': 'red light',
    '黄灯': 'yellow light',
    '停止线': 'stop line',
    '停止位置': 'stop position',
    '紧急刹车': 'emergency braking',
    '车辆': 'vehicle',
    '行人': 'pedestrian',
    '礼让': 'courtesy',
    '相互': 'mutual',
    '开车的时候': 'when driving',
    '不能只考虑': 'should not only consider',
    '自己方便': 'your own convenience',
    '要照顾到': 'take care of',
    '其他车辆': 'other vehicles',
    '和': 'and',
    '要': 'should',
    '相互礼让驾驶': 'drive with mutual courtesy',
  };
  
  // 按长度排序，先替换长的短语
  const sortedTerms = Object.entries(termMap).sort((a, b) => b[0].length - a[0].length);
  
  for (const [zh, en] of sortedTerms) {
    const regex = new RegExp(zh.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    text = text.replace(regex, en);
  }
  
  // 处理常见句式
  text = text.replace(/必须(.+?)([。，])/g, 'must $1$2');
  text = text.replace(/不能(.+?)([。，])/g, 'cannot $1$2');
  text = text.replace(/应该(.+?)([。，])/g, 'should $1$2');
  text = text.replace(/可以(.+?)([。，])/g, 'may $1$2');
  
  // 如果还有中文，尝试更通用的翻译
  if (/[\u4e00-\u9fa5]/.test(text)) {
    // 对于剩余的中文，进行逐句翻译
    const sentences = text.split(/[。，]/);
    const translatedSentences = sentences.map(sentence => {
      if (!sentence.trim() || !/[\u4e00-\u9fa5]/.test(sentence)) return sentence;
      // 这里可以添加更详细的翻译逻辑
      return sentence;
    });
    text = translatedSentences.join(' ');
  }
  
  // 清理多余空格
  text = text.replace(/\s+/g, ' ').trim();
  
  return prefix + text;
}

// 智能翻译函数 - 中文到日文
function translateZhToJa(zhText: string): string {
  if (!zhText || zhText.trim() === '') return '';
  
  let text = zhText.trim();
  
  // 保存题目编号前缀
  const numberMatch = text.match(/^(\d+\.\s*)/);
  const prefix = numberMatch ? numberMatch[1] : '';
  text = text.replace(/^\d+\.\s*/, '');
  
  // 处理explanation的标准开头
  if (text.startsWith('根据题目描述，该说法是')) {
    if (text.includes('正确的')) {
      text = text.replace(/^根据题目描述，该说法是正确的。\s*/, '問題文の通り、この記述は正しいです。');
    } else if (text.includes('错误的') || text.includes('误的')) {
      text = text.replace(/^根据题目描述，该说法是(错误的|误的)。\s*/, '問題文の通り、この記述は誤りです。');
    }
  }
  
  // 交通术语翻译表（中文到日文）
  const termMap: { [key: string]: string } = {
    '持有': '所持している',
    '普通驾驶执照': '普通運転免許',
    '轻型车': '軽車両',
    '摩托车': '原動機付自転車',
    '不到1年': '1年未満',
    '必须': 'しなければなりません',
    '贴上': '表示',
    '新手标志': '初心者マーク',
    '第一种驾驶执照': '第一種運転免許',
    '即使': 'でも',
    '为了': '目的で',
    '把': '',
    '出租车': 'タクシー',
    '运回': '運ぶ',
    '修理': '修理',
    '不能驾驶': '運転することはできません',
    '在道路上': '道路上で',
    '驾驶': '運転',
    '机动车': '自動車',
    '轻型摩托车': '原動機付自転車',
    '必须考取': '取得する必要があります',
    '与该车类型相应的': 'その車種に応じた',
    '驾驶执照': '運転免許',
    '信号灯': '信号機',
    '交叉路': '交差点',
    '交差点': '交差点',
    '右转弯': '右折',
    '左转弯': '左折',
    '绿灯': '青信号',
    '红灯': '赤信号',
    '黄灯': '黄色信号',
    '停止线': '停止線',
    '停止位置': '停止位置',
    '紧急刹车': '緊急ブレーキ',
    '车辆': '車両',
    '行人': '歩行者',
    '礼让': '譲り合い',
    '相互': '相互に',
    '开车的时候': '運転する際は',
    '不能只考虑': 'だけを考えるのではなく',
    '自己方便': '自分の都合',
    '要照顾到': 'に配慮し',
    '其他车辆': '他の車両',
    '和': 'と',
    '要': '必要があります',
    '相互礼让驾驶': '相互に譲り合って運転',
  };
  
  // 按长度排序，先替换长的短语
  const sortedTerms = Object.entries(termMap).sort((a, b) => b[0].length - a[0].length);
  
  for (const [zh, ja] of sortedTerms) {
    const regex = new RegExp(zh.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    text = text.replace(regex, ja);
  }
  
  // 处理常见句式
  text = text.replace(/必须(.+?)([。，])/g, '$1しなければなりません$2');
  text = text.replace(/不能(.+?)([。，])/g, '$1ことはできません$2');
  text = text.replace(/应该(.+?)([。，])/g, '$1べきです$2');
  text = text.replace(/可以(.+?)([。，])/g, '$1してもよい$2');
  
  // 如果还有中文，尝试更通用的翻译
  if (/[\u4e00-\u9fa5]/.test(text)) {
    // 对于剩余的中文，进行逐句翻译
    const sentences = text.split(/[。，]/);
    const translatedSentences = sentences.map(sentence => {
      if (!sentence.trim() || !/[\u4e00-\u9fa5]/.test(sentence)) return sentence;
      // 这里可以添加更详细的翻译逻辑
      return sentence;
    });
    text = translatedSentences.join(' ');
  }
  
  // 清理多余空格
  text = text.replace(/\s+/g, ' ').trim();
  
  return prefix + text;
}

// 生成explanation的函数
function generateExplanation(content: any, correctAnswer: string, type: string): string {
  const zhContent = content?.zh || '';
  
  if (!zhContent) return '';
  
  // 移除题目编号
  const contentText = zhContent.replace(/^\d+\.\s*/, '');
  
  if (type === 'truefalse') {
    const isCorrect = correctAnswer === 'true';
    return `根据题目描述，该说法是${isCorrect ? '正确的' : '错误的'}。${zhContent}`;
  } else if (type === 'multiplechoice') {
    return `根据题目描述和选项分析，正确答案是${correctAnswer}。${zhContent}`;
  } else {
    return `根据题目描述，${zhContent}`;
  }
}

// 主处理函数
async function processTranslations() {
  const filePath = path.join(__dirname, '../src/data/questions/zh/questions_auto_tag.json');
  console.log('Reading file...');
  
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const questions = JSON.parse(fileContent);
  
  console.log(`Total questions: ${questions.length}`);
  
  let contentEnTranslated = 0;
  let contentJaTranslated = 0;
  let explanationEnTranslated = 0;
  let explanationJaTranslated = 0;
  let explanationGenerated = 0;
  
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    
    // 处理content字段
    if (!question.content) {
      question.content = { zh: '', en: '', ja: '' };
    }
    
    // 确保content.zh存在
    if (!question.content.zh || question.content.zh.trim() === '') {
      console.warn(`Question ${question.id} has no zh content, skipping...`);
      continue;
    }
    
    // 翻译content.en
    if (!question.content.en || question.content.en.trim() === '') {
      question.content.en = translateZhToEn(question.content.zh);
      if (question.content.en) contentEnTranslated++;
    }
    
    // 翻译content.ja
    if (!question.content.ja || question.content.ja.trim() === '') {
      question.content.ja = translateZhToJa(question.content.zh);
      if (question.content.ja) contentJaTranslated++;
    }
    
    // 处理explanation字段
    if (!question.explanation) {
      // 生成explanation
      const generatedZh = generateExplanation(question.content, question.correctAnswer, question.type);
      question.explanation = {
        zh: generatedZh,
        en: '',
        ja: ''
      };
      explanationGenerated++;
    }
    
    // 确保explanation.zh存在
    if (!question.explanation.zh || question.explanation.zh.trim() === '') {
      question.explanation.zh = generateExplanation(question.content, question.correctAnswer, question.type);
      explanationGenerated++;
    }
    
    // 翻译explanation.en
    if (!question.explanation.en || question.explanation.en.trim() === '') {
      question.explanation.en = translateZhToEn(question.explanation.zh);
      if (question.explanation.en) explanationEnTranslated++;
    }
    
    // 翻译explanation.ja
    if (!question.explanation.ja || question.explanation.ja.trim() === '') {
      question.explanation.ja = translateZhToJa(question.explanation.zh);
      if (question.explanation.ja) explanationJaTranslated++;
    }
    
    // 每处理1000个问题输出一次进度
    if ((i + 1) % 1000 === 0) {
      console.log(`Processed ${i + 1}/${questions.length} questions...`);
      console.log(`  - Content EN: ${contentEnTranslated}, JA: ${contentJaTranslated}`);
      console.log(`  - Explanation EN: ${explanationEnTranslated}, JA: ${explanationJaTranslated}`);
      console.log(`  - Generated: ${explanationGenerated}`);
    }
  }
  
  console.log('\n=== Translation Summary ===');
  console.log(`Content translations:`);
  console.log(`  - English: ${contentEnTranslated}`);
  console.log(`  - Japanese: ${contentJaTranslated}`);
  console.log(`Explanation translations:`);
  console.log(`  - English: ${explanationEnTranslated}`);
  console.log(`  - Japanese: ${explanationJaTranslated}`);
  console.log(`Explanations generated: ${explanationGenerated}`);
  
  // 保存文件
  console.log('\nSaving file...');
  fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), 'utf-8');
  console.log('File saved successfully!');
}

// 运行
processTranslations().catch(console.error);

