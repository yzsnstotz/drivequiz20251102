// scripts/add-tags-to-original-questions.ts
// 从原始文件读取题目，保留所有原有字段，添加三个标签字段

import fs from "fs";
import path from "path";

const QUESTIONS_DIR = path.resolve(__dirname, "../src/data/questions/zh");
const OUTPUT_FILE = path.resolve(__dirname, "../src/data/questions/zhbp/questions_auto_tag.json");

// 只从questions.json读取（包含所有1376道题目）
const SOURCE_FILES = [
  "questions.json",
];

interface OriginalQuestion {
  id: number;
  type?: string;
  content: string;
  correctAnswer?: string | string[];
  explanation?: string;
  hash?: string;
  image?: string;
  category?: string;
  options?: string[];
  [key: string]: any; // 允许其他字段
}

interface TaggedQuestion extends OriginalQuestion {
  license_tags: string[];
  stage_tag: "kari" | "honmen" | "both";
  topic_tags: string[];
}

/**
 * 为单道题目生成标签（根据tagging-batch-1.md的规则）
 */
function generateTagsForQuestion(question: OriginalQuestion): {
  license_tags: string[];
  stage_tag: "kari" | "honmen" | "both";
  topic_tags: string[];
} {
  const content = question.content;
  const contentLower = content.toLowerCase();
  
  // 初始化标签
  let license_tags: string[] = ["all"];
  let stage_tag: "kari" | "honmen" | "both" = "both";
  let topic_tags: string[] = [];

  // 【一、license_tags 规则】
  // 优先检查特定车辆类型，按优先级顺序
  
  // 1. 原付相关（最高优先级，因为原付有特殊规则）
  if (
    content.includes("原付") || 
    content.includes("原動機付自転車") || 
    content.includes("轻型摩托车") ||
    content.includes("軽自動二輪") ||
    content.includes("原動機")
  ) {
    license_tags = ["moped"];
  }
  // 2. 二輪相关（摩托车）- 改进识别逻辑
  else if (
    content.includes("二輪") || 
    content.includes("两轮车") ||
    content.includes("两輪") ||
    content.includes("摩托车") || 
    content.includes("自動二輪") ||
    content.includes("二輪車") ||
    (content.includes("摩托") && !content.includes("自行车")) // 避免误判普通自行车
  ) {
    // 如果明确提到二輪特性（倾斜、制动、弯道等），肯定是bike
    // 如果只是提到二輪，也应该是bike（因为二輪有特殊规则）
    license_tags = ["bike"];
  }
  // 3. 大型货车相关
  else if (
    (content.includes("大型") && 
    (content.includes("貨物") || content.includes("货车") || 
     content.includes("車両総重量") || content.includes("最大積載量") ||
      content.includes("盲区") || content.includes("内轮差") || content.includes("内輪差") ||
      content.includes("货物固定") || content.includes("積載"))) ||
    content.includes("中型") ||
    content.includes("牵引") ||
    content.includes("牽引")
  ) {
    license_tags = ["cargo"];
  }
  // 4. 客运相关
  else if (
    content.includes("旅客") || 
    content.includes("出租车") || 
    content.includes("巴士") || 
    content.includes("タクシー") || 
    content.includes("バス") ||
    content.includes("乗合") ||
    (content.includes("二種") && (content.includes("乘客") || content.includes("服务") || content.includes("营运") || content.includes("乘客")))
  ) {
    license_tags = ["passenger"];
  }
  // 5. 特殊车辆相关
  else if (
    (content.includes("特殊") && content.includes("車")) ||
    content.includes("工程车") ||
    content.includes("ブルドーザー") ||
    content.includes("ショベルカー") ||
    content.includes("大型特殊")
  ) {
    license_tags = ["special"];
  }
  // 6. 普通汽车相关（只有在明确提到且与乘用车特性相关时，且不是通用规则）
  else if (
    (content.includes("普通自動車") || content.includes("乗用車") || 
     (content.includes("普通") && content.includes("車") && !content.includes("规则"))) &&
    !content.includes("规则") && 
    !content.includes("信号") && 
    !content.includes("标志") &&
    !content.includes("通用") &&
    !content.includes("一般")
  ) {
    license_tags = ["car"];
  }
  // 7. 默认：通用交通规则
  // license_tags 保持为 ["all"]

  // 【二、stage_tag 规则（仮免 vs 本免）】
  // 优先判断本免特有的内容

  // 1. 高速道路相关 - 本免（必须明确提到高速道路，避免"最高速度"等误判）
  const hasHighwayStage = 
    content.includes("高速公路") || 
    content.includes("高速道路") ||
    // 确保"高速"后面跟着"道路"、"公路"等，而不是"速度"
    (content.includes("高速") && !content.includes("最高速度") && !content.includes("最高速") &&
     (content.includes("道路") || content.includes("公路") || 
      content.includes("合流") || content.includes("加速车道") || 
      content.includes("加速車道") || content.includes("服务区") ||
      content.includes("服務區") || content.includes("本線"))) ||
    (content.includes("合流") && (content.includes("高速道路") || content.includes("高速公路") || 
                                   content.includes("加速车道") || content.includes("加速車道"))) ||
    (content.includes("加速车道") && (content.includes("高速") || content.includes("高速道路") || content.includes("高速公路"))) ||
    (content.includes("加速車道") && (content.includes("高速") || content.includes("高速道路") || content.includes("高速公路"))) ||
    (content.includes("服务区") && (content.includes("高速") || content.includes("高速道路") || content.includes("高速公路"))) ||
    (content.includes("服務區") && (content.includes("高速") || content.includes("高速道路") || content.includes("高速公路"))) ||
    (content.includes("本線") && (content.includes("高速") || content.includes("高速道路") || content.includes("高速公路")));
  
  if (hasHighwayStage) {
    stage_tag = "honmen";
  }
  // 2. 二輪特有技术题 - 本免
  else if (
    (content.includes("二輪") || content.includes("两轮车") || content.includes("两輪") || content.includes("摩托车")) && 
    (content.includes("倾斜") || content.includes("傾斜") || 
     content.includes("制动") || content.includes("制動") || 
     content.includes("弯道") || content.includes("彎道") ||
     content.includes("車体") || content.includes("车体") ||
     content.includes("技巧") || content.includes("转弯") || content.includes("轉彎"))
  ) {
    stage_tag = "honmen";
  }
  // 3. 大型货车特有内容 - 本免
  else if (
    content.includes("大型") && 
    (content.includes("盲区") || content.includes("盲區") || 
     content.includes("内轮差") || content.includes("內輪差") || 
     content.includes("货物固定") || content.includes("貨物固定") || 
     content.includes("高级装载") || content.includes("高級裝載") || 
     content.includes("積載") || content.includes("积载"))
  ) {
    stage_tag = "honmen";
  }
  // 4. 客运特有内容 - 本免
  else if (
    content.includes("旅客") || 
    content.includes("出租车") || 
    content.includes("巴士") ||
    content.includes("タクシー") ||
    content.includes("バス") ||
    (content.includes("二種") && (content.includes("服务规范") || content.includes("服務規範") || 
                                   content.includes("乘客上下车") || content.includes("乘客上下車") || 
                                   content.includes("营运责任") || content.includes("營運責任")))
  ) {
    stage_tag = "honmen";
  }
  // 5. 特殊车辆操作相关 - 本免
  else if (
    (content.includes("特殊") && (content.includes("操作") || content.includes("工程车") || content.includes("工程車"))) ||
    content.includes("大型特殊")
  ) {
    stage_tag = "honmen";
  }
  // 6. 仮免特有的基础内容（简单判断）
  else if (
    // 非常基础的信号灯、停止线规则，且没有复杂内容
    (content.includes("信号") || content.includes("信號") || content.includes("停止线") || content.includes("停止線")) &&
    !content.includes("高速") &&
    !content.includes("复杂") &&
    !content.includes("複雜") &&
    !content.includes("二輪") &&
    !content.includes("大型") &&
    !content.includes("特殊")
  ) {
    // 这类题目可能在仮免出现，但更可能在both出现，所以还是用both
    stage_tag = "both";
  }
  // 7. 默认：both（基础交通规则，两个阶段都可能出现）
  else {
    stage_tag = "both";
  }

  // 【三、topic_tags 规则】
  // 可以多选，按优先级和相关性添加
  
  // 1. 交通标志（优先检查，因为标志题很明确）
  if (
    content.includes("标志") || 
    content.includes("標誌") ||
    content.includes("标示") || 
    content.includes("標示") ||
    content.includes("标记") ||
    content.includes("標記") ||
    content.includes("図") ||
    content.includes("圖") ||
    content.includes("图中") ||
    content.includes("圖中") ||
    content.includes("此标志") ||
    content.includes("此標誌") ||
    content.includes("该标志") ||
    content.includes("該標誌")
  ) {
    topic_tags.push("traffic_sign");
  }
  
  // 2. 高速道路相关（必须明确提到高速道路相关词汇，避免"最高速度"等误判）
  // 使用正则表达式或更精确的匹配，确保"高速"是独立词汇
  const hasHighwayContext = 
    content.includes("高速公路") || 
    content.includes("高速道路") ||
    content.includes("高速道路") ||
    // 确保"高速"后面跟着"道路"、"公路"等，而不是"速度"
    (/\b高速[道路公路]/.test(content) || 
     (content.includes("高速") && !content.includes("最高速度") && !content.includes("最高速") &&
      (content.includes("道路") || content.includes("公路") || 
       content.includes("合流") || content.includes("加速车道") || 
       content.includes("加速車道") || content.includes("服务区") ||
       content.includes("服務區") || content.includes("本線")))) ||
    (content.includes("合流") && (content.includes("高速道路") || content.includes("高速公路") || 
                                   content.includes("加速车道") || content.includes("加速車道"))) ||
    (content.includes("加速车道") && (content.includes("高速") || content.includes("高速道路") || content.includes("高速公路"))) ||
    (content.includes("加速車道") && (content.includes("高速") || content.includes("高速道路") || content.includes("高速公路"))) ||
    (content.includes("服务区") && (content.includes("高速") || content.includes("高速道路") || content.includes("高速公路"))) ||
    (content.includes("服務區") && (content.includes("高速") || content.includes("高速道路") || content.includes("高速公路"))) ||
    (content.includes("本線") && (content.includes("高速") || content.includes("高速道路") || content.includes("高速公路")));
  
  if (hasHighwayContext) {
    topic_tags.push("highway");
  }
  
  // 3. 二輪特有技巧或规则（需要区分二輪摩托车和普通自行车）
  if (
    (content.includes("二輪") || content.includes("两轮车") || content.includes("两輪") || 
     content.includes("摩托车") || (content.includes("摩托") && !content.includes("自行车"))) && 
    (content.includes("技巧") || content.includes("倾斜") || content.includes("傾斜") || 
     content.includes("制动") || content.includes("制動") ||
     content.includes("弯道") || content.includes("彎道") || 
     content.includes("車体") || content.includes("车体") ||
     content.includes("转弯") || content.includes("轉彎"))
  ) {
    topic_tags.push("two_wheeler_only");
  }
  
  // 4. 原付特有规则（如二段式右折）
  if (
    (content.includes("原付") || content.includes("原動機付自転車") || content.includes("轻型摩托车")) && 
    (content.includes("二段式") || content.includes("右折") || content.includes("特有") ||
     content.includes("特殊规则") || content.includes("特殊規則"))
  ) {
    topic_tags.push("moped_only");
  }
  
  // 5. 大型车辆、货车、牵引车特有内容
  if (
    (content.includes("大型") && (content.includes("貨物") || content.includes("货车") || content.includes("貨車"))) ||
    content.includes("货车") ||
    content.includes("貨車") ||
    content.includes("牵引") ||
    content.includes("牽引") ||
    content.includes("中型") ||
    content.includes("車両総重量") ||
    content.includes("最大積載量") ||
    content.includes("盲区") ||
    content.includes("盲區") ||
    content.includes("内轮差") ||
    content.includes("內輪差")
  ) {
    topic_tags.push("vehicle_type_large");
  }
  
  // 6. 交叉路口相关
  if (
    content.includes("交叉路口") || 
    content.includes("交叉路") ||
    content.includes("路口") || 
    content.includes("交差点") ||
    content.includes("交差點") ||
    content.includes("十字路口") ||
    content.includes("T字路口")
  ) {
    topic_tags.push("intersection");
  }
  
  // 7. 停车与临时停车
  if (
    content.includes("停车") || 
    content.includes("停車") ||
    content.includes("临时停车") || 
    content.includes("臨時停車") ||
    content.includes("駐車") ||
    content.includes("駐停車") ||
    content.includes("停车禁止") ||
    content.includes("停車禁止")
  ) {
    topic_tags.push("parking_stopping");
  }
  
  // 8. 行人/自行车相关（注意区分普通自行车和二輪摩托车）
  if (
    (content.includes("行人") || content.includes("歩行者") || content.includes("横断") || content.includes("橫斷")) ||
    (content.includes("自行车") && !content.includes("摩托车") && !content.includes("二輪")) ||
    (content.includes("自転車") && !content.includes("二輪") && !content.includes("摩托"))
  ) {
    topic_tags.push("pedestrian");
  }
  
  // 9. 安全驾驶、危险预知、防御驾驶
  if (
    content.includes("安全") || 
    content.includes("危险") || 
    content.includes("危險") ||
    content.includes("防御") || 
    content.includes("防禦") ||
    content.includes("礼让") || 
    content.includes("禮讓") ||
    content.includes("慢行") ||
    content.includes("谨慎") ||
    content.includes("謹慎") ||
    content.includes("預知") ||
    content.includes("防御運転") ||
    content.includes("防禦運轉") ||
    content.includes("危险预知") ||
    content.includes("危險預知")
  ) {
    topic_tags.push("safety_driving");
  }
  
  // 10. 如果没有匹配到特定主题，但涉及基本规则，添加 basic_rules
  if (topic_tags.length === 0) {
    if (
      content.includes("规则") || 
      content.includes("規則") ||
      content.includes("信号") || 
      content.includes("信號") ||
      content.includes("让行") || 
      content.includes("讓行") ||
      content.includes("超车") ||
      content.includes("超車") ||
      content.includes("变更车道") ||
      content.includes("變更車道") ||
      content.includes("速度") ||
      content.includes("通行") ||
      content.includes("右转") ||
      content.includes("右轉") ||
      content.includes("左转") ||
      content.includes("左轉") ||
      content.includes("掉头") ||
      content.includes("掉頭") ||
      content.includes("驾驶证") ||
      content.includes("駕駛證") ||
      content.includes("免許") ||
      content.includes("免許証")
    ) {
      topic_tags.push("basic_rules");
    }
  }

  return {
    license_tags,
    stage_tag,
    topic_tags,
  };
}

/**
 * 从文件读取题目
 */
function loadQuestionsFromFile(filePath: string): OriginalQuestion[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  
  if (Array.isArray(data)) {
    return data;
  } else if (data.questions && Array.isArray(data.questions)) {
    return data.questions;
  } else {
    throw new Error(`文件格式错误: ${filePath}`);
  }
}

/**
 * 处理所有题目
 */
function processAllQuestions(): void {
  console.log("🚀 开始从原始文件读取题目并添加标签...");
  console.log(`📁 题目目录: ${QUESTIONS_DIR}`);

  // 只从questions.json读取
  const filePath = path.join(QUESTIONS_DIR, "questions.json");
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 文件不存在: ${filePath}`);
    process.exit(1);
  }

  const allQuestions: OriginalQuestion[] = loadQuestionsFromFile(filePath);
  console.log(`📄 questions.json: ${allQuestions.length} 道题目`);

  // 为每道题目生成标签
  const taggedQuestions: TaggedQuestion[] = [];
  let processed = 0;

  for (const question of allQuestions) {
    // 生成标签
    const tags = generateTagsForQuestion(question);
    
    // 合并原有字段和标签
    const taggedQuestion: TaggedQuestion = {
      ...question, // 保留所有原有字段
      license_tags: tags.license_tags,
      stage_tag: tags.stage_tag,
      topic_tags: tags.topic_tags,
    };
    
    taggedQuestions.push(taggedQuestion);
    processed++;

    if (processed % 100 === 0) {
      console.log(`   已处理: ${processed}/${allQuestions.length}`);
    }
  }

  // 按ID排序
  taggedQuestions.sort((a, b) => a.id - b.id);

  // 保存结果
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(taggedQuestions, null, 2), "utf8");
  
  console.log(`\n✅ 完成！`);
  console.log(`   - 总题目数: ${taggedQuestions.length}`);
  console.log(`📁 结果已保存到: ${OUTPUT_FILE}`);
  
  // 统计信息
  const licenseStats = new Map<string, number>();
  const stageStats = new Map<string, number>();
  const topicStats = new Map<string, number>();

  taggedQuestions.forEach((q) => {
    q.license_tags.forEach((tag) => {
      licenseStats.set(tag, (licenseStats.get(tag) || 0) + 1);
    });
    stageStats.set(q.stage_tag, (stageStats.get(q.stage_tag) || 0) + 1);
    q.topic_tags.forEach((tag) => {
      topicStats.set(tag, (topicStats.get(tag) || 0) + 1);
    });
  });

  console.log("\n📊 标签统计:");
  console.log("\nlicense_tags:");
  Array.from(licenseStats.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, count]) => console.log(`  ${tag}: ${count}`));
  
  console.log("\nstage_tag:");
  Array.from(stageStats.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, count]) => console.log(`  ${tag}: ${count}`));
  
  console.log("\ntopic_tags:");
  Array.from(topicStats.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, count]) => console.log(`  ${tag}: ${count}`));

  // 显示第一道题目的完整结构
  console.log("\n📋 第一道题目的完整结构:");
  console.log(JSON.stringify(taggedQuestions[0], null, 2));
}

// 运行
if (require.main === module) {
  processAllQuestions();
}

export { generateTagsForQuestion, processAllQuestions };

