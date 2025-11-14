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
  correctAnswer: string | string[];
  explanation?: {
    zh: string;
    en: string;
    ja: string;
  };
  [key: string]: any;
}

// 翻译函数 - 使用内置翻译能力
function translateToEnglish(zhText: string): string {
  // 这里使用我的翻译能力，将中文翻译成英文
  // 由于这是批量处理，我会在脚本中直接处理翻译逻辑
  return zhText; // 占位符，实际翻译在下面处理
}

function translateToJapanese(zhText: string): string {
  // 这里使用我的翻译能力，将中文翻译成日文
  return zhText; // 占位符，实际翻译在下面处理
}

// 生成解释文本
function generateExplanation(question: Question): string {
  const content = question.content.zh;
  const answer = question.correctAnswer;
  
  if (question.type === 'truefalse') {
    if (answer === 'true') {
      return `正确。${content}`;
    } else {
      return `错误。${content}`;
    }
  } else if (question.type === 'multiplechoice') {
    const correctAnswer = Array.isArray(answer) ? answer[0] : answer;
    return `正确答案是${correctAnswer}。${content}`;
  }
  
  return `根据题目内容：${content}`;
}

async function processTranslations() {
  const filePath = path.join(__dirname, '../src/data/questions/zh/questions_auto_tag.json');
  const data: Question[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  let processed = 0;
  let contentTranslated = 0;
  let explanationAdded = 0;
  let explanationTranslated = 0;
  
  console.log(`开始处理 ${data.length} 个问题...`);
  
  for (let i = 0; i < data.length; i++) {
    const question = data[i];
    let updated = false;
    
    // 处理 content 翻译
    if (!question.content.en || question.content.en === '') {
      // 需要翻译 content.zh 到 content.en
      // 这里我会在后续步骤中实际完成翻译
      updated = true;
    }
    
    if (!question.content.ja || question.content.ja === '') {
      // 需要翻译 content.zh 到 content.ja
      updated = true;
    }
    
    // 处理 explanation
    if (!question.explanation) {
      // 生成 explanation
      const zhExplanation = generateExplanation(question);
      question.explanation = {
        zh: zhExplanation,
        en: '',
        ja: ''
      };
      explanationAdded++;
      updated = true;
    } else {
      if (!question.explanation.zh || question.explanation.zh === '') {
        const zhExplanation = generateExplanation(question);
        question.explanation.zh = zhExplanation;
        updated = true;
      }
    }
    
    // 处理 explanation 翻译
    if (question.explanation) {
      if (!question.explanation.en || question.explanation.en === '') {
        updated = true;
      }
      if (!question.explanation.ja || question.explanation.ja === '') {
        updated = true;
      }
    }
    
    if (updated) {
      processed++;
    }
  }
  
  console.log(`需要处理的问题数: ${processed}`);
  console.log(`需要添加 explanation: ${explanationAdded}`);
  console.log(`需要翻译 content: ${contentTranslated}`);
  console.log(`需要翻译 explanation: ${explanationTranslated}`);
  
  // 由于文件很大，我需要分批处理并保存
  // 但首先让我读取文件并开始实际翻译
}

processTranslations().catch(console.error);


