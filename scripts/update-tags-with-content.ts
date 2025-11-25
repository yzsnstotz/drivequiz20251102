// scripts/update-tags-with-content.ts
// 根据content字段重新生成标签，并保留原有内容

import fs from "fs";
import path from "path";

const BATCH_FILE = path.resolve(__dirname, "../src/data/questions/zhbp/questions-batch-1.json");
const AUTO_TAG_FILE = path.resolve(__dirname, "../src/data/questions/zhbp/questions_auto_tag.json");
const OUTPUT_FILE = path.resolve(__dirname, "../src/data/questions/zhbp/questions_auto_tag.json");

interface QuestionWithContent {
  id: number;
  content: string;
  existingTags?: Record<string, any>;
}

interface TaggedQuestion {
  id: number;
  content: string;
  license_tags: string[];
  stage_tag: "kari" | "honmen" | "both";
  topic_tags: string[];
}

// 标签规则验证
const VALID_LICENSE_TAGS = ["all", "car", "bike", "moped", "cargo", "passenger", "special"];
const VALID_STAGE_TAGS = ["kari", "honmen", "both"];
const VALID_TOPIC_TAGS = [
  "traffic_sign",
  "basic_rules",
  "pedestrian",
  "intersection",
  "highway",
  "two_wheeler_only",
  "moped_only",
  "vehicle_type_large",
  "parking_stopping",
  "safety_driving",
];

/**
 * 为单道题目生成标签（根据tagging-batch-1.md的规则）
 */
function generateTagsForQuestion(question: QuestionWithContent): TaggedQuestion {
  const content = question.content;
  const contentLower = content.toLowerCase();
  
  // 初始化标签
  let license_tags: string[] = ["all"];
  let stage_tag: "kari" | "honmen" | "both" = "both";
  let topic_tags: string[] = [];

  // 【一、license_tags 规则】
  // 1. 如果题目是纯粹的交通规则通用内容，使用 ["all"]
  // 2. 如果题目明显只针对某种车辆
  
  // 原付相关
  if (
    content.includes("原付") || 
    content.includes("原動機付自転車") || 
    content.includes("轻型摩托车") ||
    content.includes("軽自動二輪")
  ) {
    license_tags = ["moped"];
  }
  // 二輪相关
  else if (
    (content.includes("二輪") || content.includes("摩托车") || content.includes("自動二輪")) &&
    (content.includes("倾斜") || content.includes("制动") || content.includes("弯道") || 
     content.includes("車体") || content.includes("技巧") || content.includes("特性"))
  ) {
    license_tags = ["bike"];
  }
  // 大型货车相关
  else if (
    content.includes("大型") && 
    (content.includes("貨物") || content.includes("货车") || 
     content.includes("車両総重量") || content.includes("最大積載量") ||
     content.includes("盲区") || content.includes("内轮差") || content.includes("货物固定"))
  ) {
    license_tags = ["cargo"];
  }
  // 客运相关
  else if (
    content.includes("旅客") || 
    content.includes("出租车") || 
    content.includes("巴士") || 
    content.includes("タクシー") || 
    content.includes("バス") ||
    content.includes("乗合") ||
    (content.includes("二種") && (content.includes("乘客") || content.includes("服务") || content.includes("营运")))
  ) {
    license_tags = ["passenger"];
  }
  // 特殊车辆相关
  else if (
    content.includes("特殊") || 
    content.includes("工程车") ||
    content.includes("ブルドーザー") ||
    content.includes("ショベルカー") ||
    content.includes("大型特殊")
  ) {
    license_tags = ["special"];
  }
  // 普通汽车相关（只有在明确提到且与乘用车特性相关时）
  else if (
    (content.includes("普通自動車") || content.includes("乗用車")) &&
    !content.includes("规则") && 
    !content.includes("信号") && 
    !content.includes("标志") &&
    !content.includes("通用")
  ) {
    license_tags = ["car"];
  }
  // 否则保持 ["all"]

  // 【二、stage_tag 规则】
  // 1. 仮免 (kari) 通常考：基础交通规则、简单交通标志、基本行人与车辆关系、基础安全驾驶知识
  // 2. 本免 (honmen)：高速道路、二輪独特技术、大型货车特有、二種特有、特殊车辆操作
  // 3. 如果不确定，优先使用 "both"
  
  // 高速道路相关通常是本免
  if (
    content.includes("高速") || 
    content.includes("合流") || 
    content.includes("加速车道") || 
    content.includes("服务区") ||
    content.includes("高速道路") ||
    content.includes("本線")
  ) {
    stage_tag = "honmen";
  }
  // 二輪特有技术题通常是本免
  else if (
    content.includes("二輪") && 
    (content.includes("倾斜") || content.includes("制动") || content.includes("弯道") ||
     content.includes("車体") || content.includes("技巧"))
  ) {
    stage_tag = "honmen";
  }
  // 大型货车特有内容通常是本免
  else if (
    content.includes("大型") && 
    (content.includes("盲区") || content.includes("内轮差") || content.includes("货物固定") || 
     content.includes("高级装载") || content.includes("積載"))
  ) {
    stage_tag = "honmen";
  }
  // 客运特有内容通常是本免
  else if (
    content.includes("旅客") || 
    content.includes("出租车") || 
    content.includes("巴士") ||
    (content.includes("二種") && (content.includes("服务规范") || content.includes("乘客上下车") || content.includes("营运责任")))
  ) {
    stage_tag = "honmen";
  }
  // 特殊车辆操作相关通常是本免
  else if (content.includes("特殊") && (content.includes("操作") || content.includes("工程车"))) {
    stage_tag = "honmen";
  }
  // 基础交通规则通常是 both（默认）
  else {
    stage_tag = "both";
  }

  // 【三、topic_tags 规则】
  // 交通标志
  if (
    content.includes("标志") || 
    content.includes("标示") || 
    content.includes("标记") ||
    content.includes("図") ||
    content.includes("图中")
  ) {
    topic_tags.push("traffic_sign");
  }
  
  // 交叉路口相关
  if (content.includes("交叉路口") || content.includes("路口") || content.includes("交差点")) {
    topic_tags.push("intersection");
  }
  
  // 高速道路相关
  if (content.includes("高速") || content.includes("高速公路") || content.includes("高速道路")) {
    topic_tags.push("highway");
  }
  
  // 行人/自行车相关
  if (
    content.includes("行人") || 
    content.includes("自行车") || 
    content.includes("自転車") ||
    content.includes("歩行者") ||
    content.includes("横断")
  ) {
    topic_tags.push("pedestrian");
  }
  
  // 停车与临时停车
  if (
    content.includes("停车") || 
    content.includes("临时停车") || 
    content.includes("駐車") ||
    content.includes("停車") ||
    content.includes("駐停車")
  ) {
    topic_tags.push("parking_stopping");
  }
  
  // 安全驾驶、危险预知、防御驾驶
  if (
    content.includes("安全") || 
    content.includes("危险") || 
    content.includes("防御") || 
    content.includes("礼让") || 
    content.includes("慢行") ||
    content.includes("谨慎") ||
    content.includes("預知") ||
    content.includes("防御運転")
  ) {
    topic_tags.push("safety_driving");
  }
  
  // 二輪特有技巧或规则
  if (
    content.includes("二輪") && 
    (content.includes("技巧") || content.includes("倾斜") || content.includes("制动") ||
     content.includes("弯道") || content.includes("車体"))
  ) {
    topic_tags.push("two_wheeler_only");
  }
  
  // 原付特有规则（如二段式右折）
  if (
    (content.includes("原付") || content.includes("原動機付自転車")) && 
    (content.includes("二段式") || content.includes("右折") || content.includes("特有"))
  ) {
    topic_tags.push("moped_only");
  }
  
  // 大型车辆、货车、牵引车特有内容
  if (
    content.includes("大型") || 
    content.includes("货车") || 
    content.includes("牵引") ||
    content.includes("貨物") ||
    content.includes("牽引")
  ) {
    topic_tags.push("vehicle_type_large");
  }
  
  // 如果没有匹配到特定主题，但涉及基本规则，添加 basic_rules
  if (topic_tags.length === 0) {
    if (
      content.includes("规则") || 
      content.includes("信号") || 
      content.includes("让行") || 
      content.includes("超车") ||
      content.includes("变更车道") ||
      content.includes("速度") ||
      content.includes("通行") ||
      content.includes("右转") ||
      content.includes("左转") ||
      content.includes("掉头") ||
      content.includes("驾驶证") ||
      content.includes("免許")
    ) {
      topic_tags.push("basic_rules");
    }
  }

  return {
    id: question.id,
    content: question.content,
    license_tags,
    stage_tag,
    topic_tags,
  };
}

/**
 * 处理所有题目
 */
function processAllQuestions(): void {
  console.log("🚀 开始处理题目，根据content字段生成标签...");
  console.log(`📄 读取批次文件: ${BATCH_FILE}`);

  // 读取题目数据（包含content）
  const batchData = JSON.parse(fs.readFileSync(BATCH_FILE, "utf8"));
  const questions: QuestionWithContent[] = batchData.questions;

  console.log(`📊 共 ${questions.length} 道题目需要处理`);

  // 读取现有的标签数据（如果有）
  let existingTagsMap = new Map<number, { license_tags?: string[]; stage_tag?: string; topic_tags?: string[] }>();
  try {
    const existingData = JSON.parse(fs.readFileSync(AUTO_TAG_FILE, "utf8"));
    if (Array.isArray(existingData)) {
      existingData.forEach((item: any) => {
        if (item.id) {
          existingTagsMap.set(item.id, {
            license_tags: item.license_tags,
            stage_tag: item.stage_tag,
            topic_tags: item.topic_tags,
          });
        }
      });
      console.log(`📋 读取到 ${existingTagsMap.size} 道题目的现有标签`);
    }
  } catch (error) {
    console.log("⚠️  未找到现有标签文件，将生成新标签");
  }

  // 为每道题目生成标签
  const taggedQuestions: TaggedQuestion[] = [];
  let processed = 0;
  let updated = 0;
  let newlyTagged = 0;

  for (const question of questions) {
    // 检查是否有现有标签
    const existingTags = existingTagsMap.get(question.id);
    
    // 根据content重新生成标签
    const newTags = generateTagsForQuestion(question);
    
    // 如果现有标签存在且与新标签不同，则更新
    if (existingTags) {
      if (
        JSON.stringify(existingTags.license_tags) !== JSON.stringify(newTags.license_tags) ||
        existingTags.stage_tag !== newTags.stage_tag ||
        JSON.stringify(existingTags.topic_tags) !== JSON.stringify(newTags.topic_tags)
      ) {
        updated++;
      }
    } else {
      newlyTagged++;
    }
    
    taggedQuestions.push(newTags);
    processed++;

    if (processed % 100 === 0) {
      console.log(`   已处理: ${processed}/${questions.length}`);
    }
  }

  // 保存结果（包含content和标签）
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(taggedQuestions, null, 2), "utf8");
  
  console.log(`\n✅ 完成！`);
  console.log(`   - 总题目数: ${taggedQuestions.length}`);
  console.log(`   - 新生成标签: ${newlyTagged}`);
  console.log(`   - 更新标签: ${updated}`);
  console.log(`   - 保持不变: ${taggedQuestions.length - newlyTagged - updated}`);
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
}

// 运行
if (require.main === module) {
  processAllQuestions();
}

export { generateTagsForQuestion, processAllQuestions };

