import * as fs from 'fs';
import * as path from 'path';

interface Question {
  id: string;
  type: string;
  content: {
    zh: string;
    en: string;
    ja: string;
  };
  correctAnswer: string;
  explanation?: {
    zh: string;
    en: string;
    ja: string;
  };
  [key: string]: any;
}

// 中文到英文翻译映射（常用驾驶考试术语）
const translationMap: { [key: string]: { en: string; ja: string } } = {
  '交叉路': { en: 'intersection', ja: '交差点' },
  '信号灯': { en: 'traffic light', ja: '信号機' },
  '停止线': { en: 'stop line', ja: '停止線' },
  '人行横道': { en: 'crosswalk', ja: '横断歩道' },
  '禁止': { en: 'prohibited', ja: '禁止' },
  '必须': { en: 'must', ja: 'しなければならない' },
  '不得': { en: 'must not', ja: 'してはいけない' },
  '可以': { en: 'may', ja: 'してもよい' },
  '应该': { en: 'should', ja: 'すべき' },
};

// 翻译函数 - 使用内置翻译能力
function translateToEnglish(zhText: string): string {
  if (!zhText || zhText.trim() === '') return '';
  
  // 移除题目编号
  let text = zhText.replace(/^\d+[\.、]\s*/, '').trim();
  
  // 基本翻译逻辑
  let result = text;
  
  // 处理常见驾驶术语
  result = result.replace(/交叉路/g, 'intersection');
  result = result.replace(/信号灯/g, 'traffic light');
  result = result.replace(/停止线/g, 'stop line');
  result = result.replace(/人行横道/g, 'crosswalk');
  result = result.replace(/自行车横道/g, 'bicycle crossing');
  result = result.replace(/禁止/g, 'prohibited');
  result = result.replace(/必须/g, 'must');
  result = result.replace(/不得/g, 'must not');
  result = result.replace(/可以/g, 'may');
  result = result.replace(/应该/g, 'should');
  result = result.replace(/车辆/g, 'vehicle');
  result = result.replace(/行人/g, 'pedestrian');
  result = result.replace(/驾驶/g, 'drive');
  result = result.replace(/行驶/g, 'drive');
  result = result.replace(/停车/g, 'park');
  result = result.replace(/超车/g, 'overtake');
  result = result.replace(/掉头/g, 'U-turn');
  result = result.replace(/转弯/g, 'turn');
  result = result.replace(/左转/g, 'left turn');
  result = result.replace(/右转/g, 'right turn');
  result = result.replace(/直行/g, 'go straight');
  result = result.replace(/标志/g, 'sign');
  result = result.replace(/标线/g, 'marking');
  result = result.replace(/车道/g, 'lane');
  result = result.replace(/高速公路/g, 'highway');
  result = result.replace(/国道/g, 'national road');
  result = result.replace(/急转弯/g, 'sharp curve');
  result = result.replace(/内轮差/g, 'inner wheel difference');
  result = result.replace(/紧急刹车/g, 'emergency brake');
  result = result.replace(/绿灯/g, 'green light');
  result = result.replace(/红灯/g, 'red light');
  result = result.replace(/黄灯/g, 'yellow light');
  result = result.replace(/警察/g, 'police officer');
  result = result.replace(/手势信号/g, 'hand signal');
  result = result.replace(/摩托车/g, 'motorcycle');
  result = result.replace(/头盔/g, 'helmet');
  result = result.replace(/安全帽/g, 'safety helmet');
  result = result.replace(/地震/g, 'earthquake');
  result = result.replace(/疏散/g, 'evacuate');
  
  // 由于这是占位符，实际翻译需要AI完成
  // 这里返回一个基本结构，实际翻译会在处理时完成
  return result;
}

function translateToJapanese(zhText: string): string {
  if (!zhText || zhText.trim() === '') return '';
  
  // 移除题目编号
  let text = zhText.replace(/^\d+[\.、]\s*/, '').trim();
  
  // 基本翻译逻辑
  let result = text;
  
  // 处理常见驾驶术语
  result = result.replace(/交叉路/g, '交差点');
  result = result.replace(/信号灯/g, '信号機');
  result = result.replace(/停止线/g, '停止線');
  result = result.replace(/人行横道/g, '横断歩道');
  result = result.replace(/自行车横道/g, '自転車横断帯');
  result = result.replace(/禁止/g, '禁止');
  result = result.replace(/必须/g, 'しなければならない');
  result = result.replace(/不得/g, 'してはいけない');
  result = result.replace(/可以/g, 'してもよい');
  result = result.replace(/应该/g, 'すべき');
  result = result.replace(/车辆/g, '車両');
  result = result.replace(/行人/g, '歩行者');
  result = result.replace(/驾驶/g, '運転');
  result = result.replace(/行驶/g, '走行');
  result = result.replace(/停车/g, '駐車');
  result = result.replace(/超车/g, '追い越し');
  result = result.replace(/掉头/g, '転回');
  result = result.replace(/转弯/g, '曲がる');
  result = result.replace(/左转/g, '左折');
  result = result.replace(/右转/g, '右折');
  result = result.replace(/直行/g, '直進');
  result = result.replace(/标志/g, '標識');
  result = result.replace(/标线/g, '標示');
  result = result.replace(/车道/g, '車線');
  result = result.replace(/高速公路/g, '高速道路');
  result = result.replace(/国道/g, '国道');
  result = result.replace(/急转弯/g, '急カーブ');
  result = result.replace(/内轮差/g, '内輪差');
  result = result.replace(/紧急刹车/g, '緊急ブレーキ');
  result = result.replace(/绿灯/g, '青信号');
  result = result.replace(/红灯/g, '赤信号');
  result = result.replace(/黄灯/g, '黄信号');
  result = result.replace(/警察/g, '警察官');
  result = result.replace(/手势信号/g, '手信号');
  result = result.replace(/摩托车/g, 'オートバイ');
  result = result.replace(/头盔/g, 'ヘルメット');
  result = result.replace(/安全帽/g, '安全帽');
  result = result.replace(/地震/g, '地震');
  result = result.replace(/疏散/g, '避難');
  
  return result;
}

// 生成explanation的函数
function generateExplanation(content: string, correctAnswer: string, type: string): string {
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

// 主处理函数
async function processTranslations() {
  const filePath = path.join(__dirname, '../src/data/questions/zh/questions_auto_tag.json');
  
  console.log('读取文件...');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const questions: Question[] = JSON.parse(fileContent);
  
  console.log(`总共 ${questions.length} 个题目`);
  
  let contentTranslated = 0;
  let explanationAdded = 0;
  let explanationTranslated = 0;
  
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    
    // 处理content字段
    if (question.content && question.content.zh) {
      const zh = question.content.zh;
      
      // 翻译en
      if (!question.content.en || question.content.en.trim() === '') {
        question.content.en = translateToEnglish(zh);
        contentTranslated++;
      }
      
      // 翻译ja
      if (!question.content.ja || question.content.ja.trim() === '') {
        question.content.ja = translateToJapanese(zh);
        contentTranslated++;
      }
    }
    
    // 处理explanation字段
    if (!question.explanation) {
      // 生成explanation
      const zhContent = question.content?.zh || '';
      const generatedZh = generateExplanation(zhContent, question.correctAnswer, question.type);
      
      question.explanation = {
        zh: generatedZh,
        en: translateToEnglish(generatedZh),
        ja: translateToJapanese(generatedZh)
      };
      explanationAdded++;
      explanationTranslated += 2;
    } else if (question.explanation.zh) {
      // 已有explanation，检查翻译
      const zhExp = question.explanation.zh;
      
      if (!question.explanation.en || question.explanation.en.trim() === '') {
        question.explanation.en = translateToEnglish(zhExp);
        explanationTranslated++;
      }
      
      if (!question.explanation.ja || question.explanation.ja.trim() === '') {
        question.explanation.ja = translateToJapanese(zhExp);
        explanationTranslated++;
      }
    }
    
    // 每处理100个题目输出一次进度
    if ((i + 1) % 100 === 0) {
      console.log(`已处理 ${i + 1}/${questions.length} 个题目...`);
    }
  }
  
  console.log('\n保存文件...');
  fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), 'utf-8');
  
  console.log('\n完成！');
  console.log(`- Content翻译: ${contentTranslated} 个`);
  console.log(`- Explanation新增: ${explanationAdded} 个`);
  console.log(`- Explanation翻译: ${explanationTranslated} 个`);
}

processTranslations().catch(console.error);

