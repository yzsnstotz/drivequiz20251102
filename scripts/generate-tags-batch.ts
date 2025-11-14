// scripts/generate-tags-batch.ts
// 批量生成题目标签的脚本

import fs from "fs";
import path from "path";

const BATCH_FILE = path.resolve(__dirname, "../src/data/questions/zhbp/questions-batch-1.json");
const OUTPUT_FILE = path.resolve(__dirname, "../src/data/questions/zhbp/questions_auto_tag.json");

interface Question {
  id: number;
  content: string;
  existingTags: Record<string, any>;
}

interface TaggedQuestion {
  id: number;
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
 * 为单道题目生成标签
 */
function generateTagsForQuestion(question: Question): TaggedQuestion {
  const content = question.content.toLowerCase();
  
  // 初始化标签
  let license_tags: string[] = ["all"];
  let stage_tag: "kari" | "honmen" | "both" = "both";
  let topic_tags: string[] = [];

  // 判断 license_tags
  if (content.includes("原付") || content.includes("原動機付自転車") || content.includes("轻型摩托车")) {
    license_tags = ["moped"];
  } else if (content.includes("二輪") || content.includes("摩托车")) {
    license_tags = ["bike"];
  } else if (content.includes("大型") && (content.includes("貨物") || content.includes("货车"))) {
    license_tags = ["cargo"];
  } else if (content.includes("旅客") || content.includes("出租车") || content.includes("巴士") || content.includes("タクシー") || content.includes("バス")) {
    license_tags = ["passenger"];
  } else if (content.includes("特殊") || content.includes("工程车")) {
    license_tags = ["special"];
  } else if (content.includes("普通") && (content.includes("車") || content.includes("汽车"))) {
    // 如果明确提到普通汽车，可以考虑使用 "car"
    // 但如果是通用规则，保持 "all"
    if (!content.includes("规则") && !content.includes("信号") && !content.includes("标志")) {
      license_tags = ["car"];
    }
  }

  // 判断 stage_tag
  // 高速道路相关通常是本免
  if (content.includes("高速") || content.includes("合流") || content.includes("加速车道") || content.includes("服务区")) {
    stage_tag = "honmen";
  }
  // 二輪特有技术题通常是本免
  else if (content.includes("二輪") && (content.includes("倾斜") || content.includes("制动") || content.includes("弯道"))) {
    stage_tag = "honmen";
  }
  // 大型货车特有内容通常是本免
  else if (content.includes("大型") && (content.includes("盲区") || content.includes("内轮差") || content.includes("货物固定"))) {
    stage_tag = "honmen";
  }
  // 客运特有内容通常是本免
  else if (content.includes("旅客") || content.includes("出租车") || content.includes("巴士")) {
    stage_tag = "honmen";
  }
  // 基础交通规则通常是 both
  else {
    stage_tag = "both";
  }

  // 判断 topic_tags
  if (content.includes("标志") || content.includes("标示") || content.includes("标记")) {
    topic_tags.push("traffic_sign");
  }
  
  if (content.includes("交叉路口") || content.includes("路口")) {
    topic_tags.push("intersection");
  }
  
  if (content.includes("高速") || content.includes("高速公路")) {
    topic_tags.push("highway");
  }
  
  if (content.includes("行人") || content.includes("自行车") || content.includes("自転車")) {
    topic_tags.push("pedestrian");
  }
  
  if (content.includes("停车") || content.includes("临时停车") || content.includes("駐車")) {
    topic_tags.push("parking_stopping");
  }
  
  if (content.includes("安全") || content.includes("危险") || content.includes("防御") || content.includes("礼让") || content.includes("慢行")) {
    topic_tags.push("safety_driving");
  }
  
  if (content.includes("二輪") && (content.includes("技巧") || content.includes("倾斜") || content.includes("制动"))) {
    topic_tags.push("two_wheeler_only");
  }
  
  if (content.includes("原付") && (content.includes("二段式") || content.includes("右折"))) {
    topic_tags.push("moped_only");
  }
  
  if (content.includes("大型") || content.includes("货车") || content.includes("牵引")) {
    topic_tags.push("vehicle_type_large");
  }
  
  // 如果没有匹配到特定主题，但涉及基本规则，添加 basic_rules
  if (topic_tags.length === 0 && (
    content.includes("规则") || 
    content.includes("信号") || 
    content.includes("让行") || 
    content.includes("超车") ||
    content.includes("变更车道") ||
    content.includes("速度")
  )) {
    topic_tags.push("basic_rules");
  }

  return {
    id: question.id,
    license_tags,
    stage_tag,
    topic_tags,
  };
}

/**
 * 批量处理题目
 */
function processBatch(): void {
  console.log("🚀 开始批量生成标签...");
  console.log(`📄 读取文件: ${BATCH_FILE}`);

  // 读取题目数据
  const batchData = JSON.parse(fs.readFileSync(BATCH_FILE, "utf8"));
  const questions: Question[] = batchData.questions;

  console.log(`📊 共 ${questions.length} 道题目需要处理`);

  // 为每道题目生成标签
  const taggedQuestions: TaggedQuestion[] = [];
  let processed = 0;

  for (const question of questions) {
    const tagged = generateTagsForQuestion(question);
    taggedQuestions.push(tagged);
    processed++;

    if (processed % 100 === 0) {
      console.log(`   已处理: ${processed}/${questions.length}`);
    }
  }

  // 保存结果
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(taggedQuestions, null, 2), "utf8");
  
  console.log(`\n✅ 完成！已为 ${taggedQuestions.length} 道题目生成标签`);
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
  processBatch();
}

export { generateTagsForQuestion, processBatch };

