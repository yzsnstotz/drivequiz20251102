import * as fs from 'fs';
import * as path from 'path';

// 使用更智能的翻译方法
// 由于需要处理大量文本，我会使用基于规则和上下文的翻译方法

// 中文到英文翻译 - 使用更完善的翻译逻辑
function translateZhToEn(zhText: string): string {
  if (!zhText || zhText.trim() === '') return '';
  
  let text = zhText.trim();
  
  // 保存并移除题目编号
  const numberMatch = text.match(/^(\d+\.\s*)/);
  const prefix = numberMatch ? numberMatch[1] : '';
  const originalText = text;
  text = text.replace(/^\d+\.\s*/, '');
  
  // 处理标准explanation开头
  if (text.startsWith('根据题目描述，该说法是')) {
    if (text.includes('正确的')) {
      const rest = text.replace(/^根据题目描述，该说法是正确的。\s*/, '');
      return prefix + 'According to the question description, this statement is correct. ' + translateZhToEn(rest);
    } else if (text.includes('错误的') || text.includes('误的')) {
      const rest = text.replace(/^根据题目描述，该说法是(错误的|误的)。\s*/, '');
      return prefix + 'According to the question description, this statement is incorrect. ' + translateZhToEn(rest);
    }
  }
  
  // 处理"如题所述"等简单explanation
  if (text === '如题所述' || text === '如题目所述') {
    return prefix + 'As stated in the question';
  }
  
  // 扩展的术语翻译表（按长度降序排列）
  const translations: Array<[string, string]> = [
    // 长短语优先
    ['持有普通驾驶执照或轻型车托车驾驶执照不到1年的人', 'persons who have held a regular driver\'s license or a light vehicle/motorcycle license for less than 1 year'],
    ['必须贴上新手标志', 'must display a beginner\'s mark'],
    ['持有第一种驾驶执照的人', 'a person holding a Class 1 driver\'s license'],
    ['即使是为了把出租车运回修理', 'even for the purpose of returning a taxi to a repair shop'],
    ['也不能驾驶', 'cannot drive'],
    ['在道路上驾驶机动车或轻型摩托托车时', 'when driving a motor vehicle or light motorcycle on the road'],
    ['必须考取与该车类型相应的驾驶执照', 'must obtain a driver\'s license appropriate for that vehicle type'],
    ['停在车站的公共汽车发出起动信号时', 'when a bus stopped at a station gives a starting signal'],
    ['除了必须急刹车或急打方向盘的情况以外', 'except in cases where emergency braking or sudden steering is necessary'],
    ['不得妨碍其起动', 'must not obstruct its departure'],
    ['在道路的拐角附近视野好的地方', 'at a place with good visibility near a road corner'],
    ['不用缓行', 'need not slow down'],
    ['在预测有危险的地方行驶时', 'when driving in a place where danger is anticipated'],
    ['为了避免危险而不得已的情况下', 'in unavoidable circumstances to avoid danger'],
    ['可以鸣笛', 'may sound the horn'],
    ['即使没有牵引执照', 'even without a towing license'],
    ['也可以用缆绳或起重机牵引故障车', 'may tow a broken-down vehicle with a rope or crane'],
    ['集团性地驾车行驶时', 'when driving in a group'],
    ['不得七转八弯，横冲直独地驾驶车辆', 'must not drive in a zigzag or reckless manner'],
    ['否则会给其它车辆带来麻烦', 'as this will cause trouble for other vehicles'],
    
    // 常用短语
    ['开车的时候', 'when driving'],
    ['不能只考虑自己方便', 'should not only consider your own convenience'],
    ['要照顾到其他车辆和行人', 'take care of other vehicles and pedestrians'],
    ['要相互礼让驾驶', 'drive with mutual courtesy'],
    ['在有信号灯的交叉路', 'at an intersection with traffic lights'],
    ['想在右转弯的时候', 'when you want to make a right turn'],
    ['因对面是绿灯', 'because the opposite signal was green'],
    ['进入了交叉路', 'entered the intersection'],
    ['但右转弯方向的信号是红灯时', 'but the signal in the right turn direction was red'],
    ['此时在交叉路中停下来了', 'you stopped in the intersection'],
    ['在前方的信号灯变为黄灯的时候', 'when the traffic light ahead turns yellow'],
    ['已接近停止位置', 'if you are close to the stop position'],
    ['如果不紧急刹车不能停下来的时候', 'and cannot stop without emergency braking'],
    ['可以直接进入', 'you may proceed directly'],
    ['没有停止线的停止位置', 'if there is no stop line, the stopping position'],
    ['是停在信号灯的跟前', 'is directly in front of the traffic light'],
    
    // 单个词汇
    ['持有', 'holding'],
    ['普通驾驶执照', 'regular driver\'s license'],
    ['轻型车', 'light vehicle'],
    ['摩托车', 'motorcycle'],
    ['不到1年', 'for less than 1 year'],
    ['必须', 'must'],
    ['贴上', 'display'],
    ['新手标志', 'beginner\'s mark'],
    ['第一种驾驶执照', 'Class 1 driver\'s license'],
    ['即使', 'even'],
    ['为了', 'for the purpose of'],
    ['出租车', 'taxi'],
    ['运回', 'return'],
    ['修理', 'repair'],
    ['不能驾驶', 'cannot drive'],
    ['在道路上', 'on the road'],
    ['驾驶', 'driving'],
    ['机动车', 'motor vehicle'],
    ['轻型摩托车', 'light motorcycle'],
    ['必须考取', 'must obtain'],
    ['与该车类型相应的', 'appropriate for that vehicle type'],
    ['驾驶执照', 'driver\'s license'],
    ['信号灯', 'traffic light'],
    ['交叉路', 'intersection'],
    ['交差点', 'intersection'],
    ['右转弯', 'right turn'],
    ['左转弯', 'left turn'],
    ['绿灯', 'green light'],
    ['红灯', 'red light'],
    ['黄灯', 'yellow light'],
    ['停止线', 'stop line'],
    ['停止位置', 'stop position'],
    ['紧急刹车', 'emergency braking'],
    ['车辆', 'vehicle'],
    ['行人', 'pedestrian'],
    ['礼让', 'courtesy'],
    ['相互', 'mutual'],
    ['根据题目描述', 'according to the question description'],
    ['该说法是正确的', 'this statement is correct'],
    ['该说法是错误的', 'this statement is incorrect'],
    ['该说法是误的', 'this statement is incorrect'],
  ];
  
  // 应用翻译（按长度降序）
  for (const [zh, en] of translations) {
    const regex = new RegExp(zh.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    text = text.replace(regex, en);
  }
  
  // 如果还有大量中文，说明需要更细致的处理
  const chineseCharCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  if (chineseCharCount > 5) {
    // 对于复杂句子，进行逐句处理
    const sentences = text.split(/[。，；]/);
    const translatedSentences = sentences.map(sentence => {
      if (!sentence.trim()) return '';
      // 如果句子主要是中文，尝试更细致的翻译
      if (/[\u4e00-\u9fa5]/.test(sentence)) {
        // 这里可以添加更复杂的翻译逻辑
        // 暂时返回原句，后续会改进
        return sentence;
      }
      return sentence;
    }).filter(s => s.trim());
    text = translatedSentences.join(' ');
  }
  
  // 清理和格式化
  text = text.replace(/\s+/g, ' ').trim();
  
  // 如果翻译结果还是主要是中文，使用原文本（标记需要人工处理）
  if ((text.match(/[\u4e00-\u9fa5]/g) || []).length > text.length * 0.3) {
    // 返回一个基于原文本的翻译尝试
    return prefix + '[Translation needed: ' + originalText + ']';
  }
  
  return prefix + text;
}

// 中文到日文翻译
function translateZhToJa(zhText: string): string {
  if (!zhText || zhText.trim() === '') return '';
  
  let text = zhText.trim();
  
  // 保存并移除题目编号
  const numberMatch = text.match(/^(\d+\.\s*)/);
  const prefix = numberMatch ? numberMatch[1] : '';
  const originalText = text;
  text = text.replace(/^\d+\.\s*/, '');
  
  // 处理标准explanation开头
  if (text.startsWith('根据题目描述，该说法是')) {
    if (text.includes('正确的')) {
      const rest = text.replace(/^根据题目描述，该说法是正确的。\s*/, '');
      return prefix + '問題文の通り、この記述は正しいです。' + translateZhToJa(rest);
    } else if (text.includes('错误的') || text.includes('误的')) {
      const rest = text.replace(/^根据题目描述，该说法是(错误的|误的)。\s*/, '');
      return prefix + '問題文の通り、この記述は誤りです。' + translateZhToJa(rest);
    }
  }
  
  // 处理"如题所述"等简单explanation
  if (text === '如题所述' || text === '如题目所述') {
    return prefix + '問題文の通り';
  }
  
  // 扩展的术语翻译表（中文到日文）
  const translations: Array<[string, string]> = [
    // 长短语优先
    ['持有普通驾驶执照或轻型车托车驾驶执照不到1年的人', '普通運転免許または軽車両・原動機付自転車の免許を取得してから1年未満の者'],
    ['必须贴上新手标志', '初心者マークを表示しなければなりません'],
    ['持有第一种驾驶执照的人', '第一種運転免許を所持している者'],
    ['即使是为了把出租车运回修理', 'タクシーを修理に運ぶ目的であっても'],
    ['也不能驾驶', '運転することはできません'],
    ['在道路上驾驶机动车或轻型摩托托车时', '道路上で自動車または原動機付自転車を運転する際は'],
    ['必须考取与该车类型相应的驾驶执照', 'その車種に応じた運転免許を取得する必要があります'],
    ['停在车站的公共汽车发出起动信号时', '停留所に停車しているバスが発進の合図を出したとき'],
    ['除了必须急刹车或急打方向盘的情况以外', '急ブレーキや急ハンドルを切らなければならない場合を除き'],
    ['不得妨碍其起动', 'その発進を妨げてはならない'],
    ['在道路的拐角附近视野好的地方', '道路の角付近で見通しの良い場所'],
    ['不用缓行', '徐行する必要はない'],
    ['在预测有危险的地方行驶时', '危険が予測される場所を走行する際'],
    ['为了避免危险而不得已的情况下', '危険を避けるためにやむを得ない場合'],
    ['可以鸣笛', '警音器を鳴らすことができる'],
    ['即使没有牵引执照', '牽引免許がなくても'],
    ['也可以用缆绳或起重机牵引故障车', 'ロープやクレーンで故障車を牽引することができる'],
    ['集团性地驾车行驶时', '集団で車を運転する際は'],
    ['不得七转八弯，横冲直独地驾驶车辆', '七転八倒したり、横暴に運転したりしてはいけません'],
    ['否则会给其它车辆带来麻烦', 'そうしないと、他の車両に迷惑をかけることになります'],
    
    // 常用短语
    ['开车的时候', '運転する際は'],
    ['不能只考虑自己方便', '自分の都合だけを考えるのではなく'],
    ['要照顾到其他车辆和行人', '他の車両や歩行者に配慮し'],
    ['要相互礼让驾驶', '相互に譲り合って運転する必要があります'],
    ['在有信号灯的交叉路', '信号機のある交差点で'],
    ['想在右转弯的时候', '右折しようとした際'],
    ['因对面是绿灯', '対向が青信号で'],
    ['进入了交叉路', '交差点に入った'],
    ['但右转弯方向的信号是红灯时', '右折方向の信号が赤信号だったため'],
    ['此时在交叉路中停下来了', '交差点内で停車した'],
    ['在前方的信号灯变为黄灯的时候', '前方の信号機が黄色に変わったとき'],
    ['已接近停止位置', '停止位置に近づいており'],
    ['如果不紧急刹车不能停下来的时候', '緊急ブレーキをかけなければ止まれない場合は'],
    ['可以直接进入', 'そのまま進入してもよい'],
    ['没有停止线的停止位置', '停止線がない場合の停止位置'],
    ['是停在信号灯的跟前', '信号機の直前である'],
    
    // 单个词汇
    ['持有', '所持している'],
    ['普通驾驶执照', '普通運転免許'],
    ['轻型车', '軽車両'],
    ['摩托车', '原動機付自転車'],
    ['不到1年', '1年未満'],
    ['必须', 'しなければなりません'],
    ['贴上', '表示'],
    ['新手标志', '初心者マーク'],
    ['第一种驾驶执照', '第一種運転免許'],
    ['即使', 'でも'],
    ['为了', '目的で'],
    ['出租车', 'タクシー'],
    ['运回', '運ぶ'],
    ['修理', '修理'],
    ['不能驾驶', '運転することはできません'],
    ['在道路上', '道路上で'],
    ['驾驶', '運転'],
    ['机动车', '自動車'],
    ['轻型摩托车', '原動機付自転車'],
    ['必须考取', '取得する必要があります'],
    ['与该车类型相应的', 'その車種に応じた'],
    ['驾驶执照', '運転免許'],
    ['信号灯', '信号機'],
    ['交叉路', '交差点'],
    ['交差点', '交差点'],
    ['右转弯', '右折'],
    ['左转弯', '左折'],
    ['绿灯', '青信号'],
    ['红灯', '赤信号'],
    ['黄灯', '黄色信号'],
    ['停止线', '停止線'],
    ['停止位置', '停止位置'],
    ['紧急刹车', '緊急ブレーキ'],
    ['车辆', '車両'],
    ['行人', '歩行者'],
    ['礼让', '譲り合い'],
    ['相互', '相互に'],
  ];
  
  // 应用翻译（按长度降序）
  for (const [zh, ja] of translations) {
    const regex = new RegExp(zh.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    text = text.replace(regex, ja);
  }
  
  // 如果还有大量中文，说明需要更细致的处理
  const chineseCharCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  if (chineseCharCount > 5) {
    // 对于复杂句子，进行逐句处理
    const sentences = text.split(/[。，；]/);
    const translatedSentences = sentences.map(sentence => {
      if (!sentence.trim()) return '';
      // 如果句子主要是中文，尝试更细致的翻译
      if (/[\u4e00-\u9fa5]/.test(sentence)) {
        return sentence;
      }
      return sentence;
    }).filter(s => s.trim());
    text = translatedSentences.join(' ');
  }
  
  // 清理和格式化
  text = text.replace(/\s+/g, ' ').trim();
  
  // 如果翻译结果还是主要是中文，使用原文本（标记需要人工处理）
  if ((text.match(/[\u4e00-\u9fa5]/g) || []).length > text.length * 0.3) {
    return prefix + '[Translation needed: ' + originalText + ']';
  }
  
  return prefix + text;
}

// 生成explanation的函数
function generateExplanation(content: any, correctAnswer: string, type: string): string {
  const zhContent = content?.zh || '';
  
  if (!zhContent) return '';
  
  // 移除题目编号（如果存在）
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
  let skipped = 0;
  
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    
    try {
      // 处理content字段
      if (!question.content) {
        question.content = { zh: '', en: '', ja: '' };
      }
      
      // 确保content.zh存在
      if (!question.content.zh || question.content.zh.trim() === '') {
        skipped++;
        continue;
      }
      
      // 翻译content.en
      if (!question.content.en || question.content.en.trim() === '') {
        const translated = translateZhToEn(question.content.zh);
        if (translated && !translated.includes('[Translation needed:')) {
          question.content.en = translated;
          contentEnTranslated++;
        }
      }
      
      // 翻译content.ja
      if (!question.content.ja || question.content.ja.trim() === '') {
        const translated = translateZhToJa(question.content.zh);
        if (translated && !translated.includes('[Translation needed:')) {
          question.content.ja = translated;
          contentJaTranslated++;
        }
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
        const translated = translateZhToEn(question.explanation.zh);
        if (translated && !translated.includes('[Translation needed:')) {
          question.explanation.en = translated;
          explanationEnTranslated++;
        }
      }
      
      // 翻译explanation.ja
      if (!question.explanation.ja || question.explanation.ja.trim() === '') {
        const translated = translateZhToJa(question.explanation.zh);
        if (translated && !translated.includes('[Translation needed:')) {
          question.explanation.ja = translated;
          explanationJaTranslated++;
        }
      }
    } catch (error) {
      console.error(`Error processing question ${question.id}:`, error);
      skipped++;
    }
    
    // 每处理1000个问题输出一次进度
    if ((i + 1) % 1000 === 0) {
      console.log(`Processed ${i + 1}/${questions.length} questions...`);
      console.log(`  - Content EN: ${contentEnTranslated}, JA: ${contentJaTranslated}`);
      console.log(`  - Explanation EN: ${explanationEnTranslated}, JA: ${explanationJaTranslated}`);
      console.log(`  - Generated: ${explanationGenerated}, Skipped: ${skipped}`);
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
  console.log(`Skipped: ${skipped}`);
  
  // 保存文件
  console.log('\nSaving file...');
  fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), 'utf-8');
  console.log('File saved successfully!');
}

// 运行
processTranslations().catch(console.error);

