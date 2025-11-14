// scripts/auto-tag-questions.ts
// 此脚本用于生成包含题目和prompt的文件，供Cursor的agent处理

import fs from "fs";
import path from "path";

// ---------- 配置区：可按需修改 ----------

// 题目处理目录（zhb目录）
const QUESTIONS_DIR = path.resolve(__dirname, "../src/data/questions/zhb");

// 生成的prompt文件输出目录
const PROMPT_OUTPUT_DIR = path.resolve(__dirname, "../src/data/questions/zhbp");

// 每次批处理题目数量（设置为很大的值，一次性处理全部题目）
const BATCH_SIZE = Number.MAX_SAFE_INTEGER;

// ---------- 类型定义 ----------

// zhb目录下的题目结构
type ZhbQuestion = {
  id: number;
  type: string;
  content: string;
  correctAnswer?: string;
  explanation?: string;
  hash?: string;
  image?: string;
  license_tags?: string[];
  stage_tag?: "kari" | "honmen" | "both";
  topic_tags?: string[];
};

// 带标签的题目结构（在原有字段基础上添加标签）
type TaggedZhbQuestion = ZhbQuestion & {
  license_tags: string[];
  stage_tag: "kari" | "honmen" | "both";
  topic_tags: string[];
};

// 文件结构
type QuestionFile = {
  questions: ZhbQuestion[];
  version?: string;
};

// 验证license_tags
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

// ---------- 核心 Prompt 模板 ----------

const SYSTEM_PROMPT = `你是一名日本驾驶考试题库分类专家，熟悉日本《道路交通法》以及所有驾照种类
（普通、二輪、原付、中型、大型、牵引、二種、大型特殊），并熟悉「仮免」（临时驾照）与「本免」（正式考试）阶段的差异。

你的任务：
给每一道题目打上三个维度的标签：
1) license_tags[]  题目适用的驾照类型
2) stage_tag       题目属于仮免 / 本免 / 两者
3) topic_tags[]    题目所属知识主题

【一、license_tags 规则】

license_tags 只能从以下集合中选择：
- "all"       通用交通规则，适用于所有驾照
- "car"       普通汽车（普通免許）
- "bike"      摩托车（二輪）：小型 / 普通 / 大型
- "moped"     原付（原動機付自転車）
- "cargo"     货物类：中型 / 大型 / 牵引 等
- "passenger" 客运类：二種免許（出租车 / 巴士）
- "special"   大型特殊（工程车，如ブルドーザー、ショベルカー等）

优先规则：
1. 如果题目是纯粹的交通规则通用内容（信号灯、停止线、基础让行规则、一般道路标志等），
   → 使用 ["all"]，不要额外加 "car"、"bike" 等。
2. 如果题目明显只针对某种车辆：
   - 出现「原動機付自転車」「原付」相关 → 必须包含 "moped"
   - 出现「自動二輪車」「二輪車」 且内容与二輪特性相关 → 使用 "bike"
   - 出现「大型貨物自動車」「車両総重量」「最大積載量」等 → 使用 "cargo"
   - 出现「普通自動車」「乗用車」 且与乘用车特性相关 → 可以使用 "car"
   - 出现「旅客自動車」「乗合バス」「タクシー」且与乘客安全、营运规范相关 → 使用 "passenger"
   - 出现工程车、特殊作业车相关 → 使用 "special"
3. 不要同时使用多个具体驾照标签（如 "car" + "bike"），
   如果适用多个，请改用 "all"。

【二、stage_tag 规则（仮免 vs 本免）】

stage_tag 必须从以下集合中选择：
- "kari"   仮免試験（临时驾照考试）会出现
- "honmen" 本免試験（正式驾驶证考试）会出现
- "both"   两个阶段都可能出现

判定规则：
1. 仮免 (kari) 通常考：
   - 基础交通规则：信号灯、停止线、基本让行顺序
   - 简单交通标志：速度限制、停车禁止、进出禁止等
   - 基本行人与车辆关系
   - 基础安全驾驶知识（例如保持车距的概念）
2. 不会在仮免出现、主要属于本免 (honmen) 的题目：
   - 高速道路的合流、加速车道、服务区和车道规则
   - 二輪独特的技术题（车体倾斜、复杂制动、弯道技巧等）
   - 大型货车特有的盲区、内轮差、货物固定、高级装载规则等
   - 二種（客运）特有的服务规范、乘客上下车安全、营运责任
   - 特殊车辆（工程车）操作相关
3. 如果题目属于相当基础的交通规则，且在仮免与本免中都可能出现，
   → 使用 "both"。
4. 如果不确定，优先使用 "both"，不要随意猜测 "kari" 或 "honmen"。

【三、topic_tags 规则】

topic_tags 只能从以下集合中选择，可以多选：
- "traffic_sign"       交通标志
- "basic_rules"        一般通行规则
- "pedestrian"         行人 / 自行车相关
- "intersection"       交叉路口相关
- "highway"            高速道路相关
- "two_wheeler_only"   二輪特有技巧或规则
- "moped_only"         原付特有规则（如二段式右折）
- "vehicle_type_large" 大型车辆、货车、牵引车特有内容
- "parking_stopping"   停车与临时停车
- "safety_driving"     安全驾驶、危险预知、防御驾驶等

如果没有合适的 topic，可返回空数组 []，不要创造新标签。

【四、输出格式】

你将收到一个包含多道题目的数组。每道题目包含：
- id           题目唯一 ID
- content      题目内容（中文）

请仅输出一个 JSON 数组，每个元素对应一道题，格式如下：

[
  {
    "id": 1,
    "license_tags": ["all"],
    "stage_tag": "both",
    "topic_tags": ["intersection", "basic_rules"]
  },
  {
    "id": 2,
    "license_tags": ["car"],
    "stage_tag": "honmen",
    "topic_tags": ["highway"]
  }
]

不要输出多余的说明文字，只输出JSON数组。`;

// ---------- 工具函数：读取和处理文件 ----------

function loadQuestionsFromFile(filePath: string): { questions: ZhbQuestion[]; version?: string } {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw) as QuestionFile;
  
  if (!data.questions || !Array.isArray(data.questions)) {
    throw new Error(`文件格式错误: ${filePath}，缺少questions数组`);
  }

  return {
    questions: data.questions,
    version: data.version,
  };
}

function saveQuestionsToFile(filePath: string, questions: TaggedZhbQuestion[], version?: string): void {
  const outputData = {
    questions,
    ...(version && { version }),
  };
  fs.writeFileSync(filePath, JSON.stringify(outputData, null, 2), "utf8");
}

// ---------- 生成Prompt文件 ----------

/**
 * 生成包含题目和prompt的markdown文件，供Cursor的agent处理
 */
function generatePromptFile(
  batchId: number,
  questions: ZhbQuestion[],
  sourceFile: string | string[]
): string {
  const questionsData = questions.map((q) => ({
    id: q.id,
    content: q.content,
  }));

  const sourceFileStr = Array.isArray(sourceFile) ? sourceFile.join(", ") : sourceFile;
  
  const promptContent = `# 题目标签生成任务 - 批次 ${batchId}

## 任务说明

请使用Cursor的AI功能为以下题目生成标签。每道题目需要三个维度的标签：
1. license_tags: 题目适用的驾照类型
2. stage_tag: 题目属于仮免/本免/两者
3. topic_tags: 题目所属知识主题

## 标签规则

${SYSTEM_PROMPT}

## 需要处理的题目

共 ${questionsData.length} 道题目：

\`\`\`json
${JSON.stringify(questionsData, null, 2)}
\`\`\`

## 输出要求

请为每道题目生成标签，输出格式为JSON数组：

\`\`\`json
[
  {
    "id": 1,
    "license_tags": ["all"],
    "stage_tag": "both",
    "topic_tags": ["intersection", "basic_rules"]
  }
]
\`\`\`

## 注意事项

1. 只输出JSON数组，不要其他说明文字
2. 确保所有标签值都在允许的范围内
3. 如果题目已有部分标签，请保留并补充缺失的标签
4. 源文件：${sourceFileStr}
`;

  const outputPath = path.join(PROMPT_OUTPUT_DIR, `tagging-batch-${batchId}.md`);
  fs.writeFileSync(outputPath, promptContent, "utf8");
  
  return outputPath;
}

/**
 * 生成包含所有题目的JSON文件，用于批量处理
 */
function generateQuestionsJsonFile(
  batchId: number,
  questions: ZhbQuestion[],
  sourceFile: string | string[]
): string {
  const sourceFileStr = Array.isArray(sourceFile) ? sourceFile.join(", ") : path.basename(sourceFile);
  
  const data = {
    batchId,
    sourceFile: sourceFileStr,
    timestamp: new Date().toISOString(),
    questions: questions.map((q) => ({
      id: q.id,
      content: q.content,
      existingTags: {
        license_tags: q.license_tags,
        stage_tag: q.stage_tag,
        topic_tags: q.topic_tags,
      },
    })),
  };

  const outputPath = path.join(PROMPT_OUTPUT_DIR, `questions-batch-${batchId}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf8");
  
  return outputPath;
}

// ---------- 处理单个文件 ----------

function processFile(filePath: string): {
  total: number;
  needsTagging: number;
  batches: Array<{ batchId: number; questions: ZhbQuestion[] }>;
} {
  console.log(`\n📄 处理文件: ${path.basename(filePath)}`);
  
  const { questions } = loadQuestionsFromFile(filePath);
  console.log(`   共 ${questions.length} 道题目`);

  // 检查哪些题目需要打标签
  const questionsNeedingTags = questions.filter(
    (q) => !q.license_tags || !q.stage_tag || !q.topic_tags
  );
  
  const questionsWithTags = questions.filter(
    (q) => q.license_tags && q.stage_tag && q.topic_tags
  );

  console.log(`   - 已有标签: ${questionsWithTags.length} 道`);
  console.log(`   - 需要打标签: ${questionsNeedingTags.length} 道`);

  if (questionsNeedingTags.length === 0) {
    console.log(`   ✅ 所有题目已有标签，跳过`);
    return { total: questions.length, needsTagging: 0, batches: [] };
  }

  // 将需要打标签的题目分批
  const batches: Array<{ batchId: number; questions: ZhbQuestion[] }> = [];
  for (let i = 0; i < questionsNeedingTags.length; i += BATCH_SIZE) {
    const batch = questionsNeedingTags.slice(i, i + BATCH_SIZE);
    batches.push({
      batchId: batches.length + 1,
      questions: batch,
    });
  }

  return {
    total: questions.length,
    needsTagging: questionsNeedingTags.length,
    batches,
  };
}

// ---------- 应用标签结果 ----------

/**
 * 从Cursor agent处理后的结果文件中读取标签，并应用到原文件
 */
function applyTagsFromResult(
  filePath: string,
  resultFilePath: string
): void {
  console.log(`\n📥 应用标签结果: ${path.basename(resultFilePath)}`);

  // 读取原文件
  const { questions, version } = loadQuestionsFromFile(filePath);
  
  // 读取结果文件
  let resultData: Array<{
    id: number;
    license_tags: string[];
    stage_tag: "kari" | "honmen" | "both";
    topic_tags: string[];
  }>;

  try {
    const resultContent = fs.readFileSync(resultFilePath, "utf8");
    // 尝试提取JSON数组
    const jsonMatch = resultContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("结果文件中未找到JSON数组");
    }
    resultData = JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error(`❌ 读取结果文件失败: ${resultFilePath}`, error);
    throw error;
  }

  // 创建ID到标签的映射
  const tagsMap = new Map(
    resultData.map((item) => [
      item.id,
      {
        license_tags: item.license_tags,
        stage_tag: item.stage_tag,
        topic_tags: item.topic_tags,
      },
    ])
  );

  // 应用标签到题目
  let updatedCount = 0;
  const updatedQuestions = questions.map((q) => {
    const tags = tagsMap.get(q.id);
    if (tags) {
      updatedCount++;
      return {
        ...q,
        license_tags: tags.license_tags,
        stage_tag: tags.stage_tag,
        topic_tags: tags.topic_tags,
      };
    }
    return q;
  });

  // 保存文件
  saveQuestionsToFile(filePath, updatedQuestions as TaggedZhbQuestion[], version);
  console.log(`   ✅ 已更新 ${updatedCount} 道题目的标签`);
}

/**
 * 从批量结果文件中读取标签，并应用到所有相关源文件
 */
function applyTagsFromBatchResult(
  batchJsonFile: string,
  resultFilePath: string
): void {
  console.log(`\n📥 应用批量标签结果`);
  console.log(`   批次文件: ${path.basename(batchJsonFile)}`);
  console.log(`   结果文件: ${path.basename(resultFilePath)}`);

  // 读取批次文件，获取题目ID到源文件的映射
  const batchData = JSON.parse(fs.readFileSync(batchJsonFile, "utf8"));
  const questionIdToSourceFile = new Map<number, string>();
  
  // 从questions-batch-*.json中无法直接获取源文件信息，需要从题目ID推断
  // 或者我们可以读取所有源文件，然后根据ID匹配
  
  // 读取结果文件
  let resultData: Array<{
    id: number;
    license_tags: string[];
    stage_tag: "kari" | "honmen" | "both";
    topic_tags: string[];
  }>;

  try {
    const resultContent = fs.readFileSync(resultFilePath, "utf8");
    const jsonMatch = resultContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("结果文件中未找到JSON数组");
    }
    resultData = JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error(`❌ 读取结果文件失败: ${resultFilePath}`, error);
    throw error;
  }

  // 创建ID到标签的映射
  const tagsMap = new Map(
    resultData.map((item) => [
      item.id,
      {
        license_tags: item.license_tags,
        stage_tag: item.stage_tag,
        topic_tags: item.topic_tags,
      },
    ])
  );

  // 读取所有源文件，应用标签
  const files = fs
    .readdirSync(QUESTIONS_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(QUESTIONS_DIR, file));

  let totalUpdated = 0;
  const fileUpdateCount = new Map<string, number>();

  for (const file of files) {
    try {
      const { questions, version } = loadQuestionsFromFile(file);
      let fileUpdatedCount = 0;

      const updatedQuestions = questions.map((q) => {
        const tags = tagsMap.get(q.id);
        if (tags) {
          fileUpdatedCount++;
          totalUpdated++;
          return {
            ...q,
            license_tags: tags.license_tags,
            stage_tag: tags.stage_tag,
            topic_tags: tags.topic_tags,
          };
        }
        return q;
      });

      if (fileUpdatedCount > 0) {
        saveQuestionsToFile(file, updatedQuestions as TaggedZhbQuestion[], version);
        fileUpdateCount.set(path.basename(file), fileUpdatedCount);
        console.log(`   ✅ ${path.basename(file)}: 更新了 ${fileUpdatedCount} 道题目`);
      }
    } catch (error) {
      console.error(`   ❌ 处理文件失败: ${path.basename(file)}`, error);
    }
  }

  console.log(`\n✅ 批量应用完成：共更新 ${totalUpdated} 道题目，涉及 ${fileUpdateCount.size} 个文件`);
}

// ---------- 主流程 ----------

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // 命令1: generate - 生成prompt文件
  if (command === "generate") {
    console.log("🚀 开始生成标签任务文件");
    console.log(`📁 题目目录: ${QUESTIONS_DIR}`);
    console.log(`📁 输出目录: ${PROMPT_OUTPUT_DIR}`);

    // 检查目录是否存在
    if (!fs.existsSync(QUESTIONS_DIR)) {
      console.error(`❌ 目录不存在: ${QUESTIONS_DIR}`);
      process.exit(1);
    }

    // 创建输出目录
    if (!fs.existsSync(PROMPT_OUTPUT_DIR)) {
      fs.mkdirSync(PROMPT_OUTPUT_DIR, { recursive: true });
    }

    // 读取所有JSON文件
    const files = fs
      .readdirSync(QUESTIONS_DIR)
      .filter((file) => file.endsWith(".json"))
      .map((file) => path.join(QUESTIONS_DIR, file));

    if (files.length === 0) {
      console.error(`❌ 未找到JSON文件: ${QUESTIONS_DIR}`);
      process.exit(1);
    }

    console.log(`\n找到 ${files.length} 个文件`);

    // 收集所有需要打标签的题目
    const allQuestionsNeedingTags: Array<{ question: ZhbQuestion; sourceFile: string }> = [];
    const fileMap = new Map<string, string>(); // 题目ID到源文件的映射

    // 处理每个文件，收集需要打标签的题目
    for (const file of files) {
      try {
        const { questions } = loadQuestionsFromFile(file);
        const questionsNeedingTags = questions.filter(
          (q) => !q.license_tags || !q.stage_tag || !q.topic_tags
        );
        
        for (const q of questionsNeedingTags) {
          allQuestionsNeedingTags.push({
            question: q,
            sourceFile: path.basename(file),
          });
          fileMap.set(`${q.id}`, path.basename(file));
        }
      } catch (err) {
        console.error(`❌ 处理文件失败: ${file}`, err);
      }
    }

    const totalBatches = allQuestionsNeedingTags.length > 0 ? 1 : 0;
    const batchFiles: Array<{ sourceFile: string; batchId: number; promptFile: string; jsonFile: string }> = [];

    // 如果所有题目都有标签，直接返回
    if (totalBatches === 0) {
      console.log(`\n✅ 所有题目已有标签，无需生成任务文件`);
      return;
    }

    // 将所有题目合并到一个批次
    const allQuestions = allQuestionsNeedingTags.map((item) => item.question);
    const sourceFilesList = Array.from(new Set(allQuestionsNeedingTags.map((item) => item.sourceFile))).join(", ");
    
    const promptFile = generatePromptFile(1, allQuestions, sourceFilesList);
    const jsonFile = generateQuestionsJsonFile(1, allQuestions, sourceFilesList);
    
    batchFiles.push({
      sourceFile: sourceFilesList,
      batchId: 1,
      promptFile,
      jsonFile,
    });
    
    console.log(`\n📝 生成批次 1 (包含 ${allQuestions.length} 道题目): ${path.basename(promptFile)}`);

    // 生成索引文件
    const indexContent = `# 标签生成任务索引

生成时间: ${new Date().toISOString()}

## 任务列表

${batchFiles.map((b) => `- 批次 ${b.batchId} (来源: ${b.sourceFile})
  - Prompt文件: \`${path.basename(b.promptFile)}\`
  - 题目数据: \`${path.basename(b.jsonFile)}\`
`).join("\n")}

## 使用说明

1. 打开对应的 \`tagging-batch-*.md\` 文件
2. 使用Cursor的AI功能（Cmd+K 或 Cmd+L）处理该文件
3. 让AI生成标签JSON数组
4. 将结果保存到 \`result-batch-*.json\` 文件
5. 运行 \`npx tsx scripts/auto-tag-questions.ts apply <源文件> <结果文件>\` 应用标签

## 总览

- 总批次数: ${totalBatches}
- 需要处理的题目数: ${batchFiles.reduce((sum, b) => sum + JSON.parse(fs.readFileSync(b.jsonFile, "utf8")).questions.length, 0)}
`;

    const indexPath = path.join(PROMPT_OUTPUT_DIR, "INDEX.md");
    fs.writeFileSync(indexPath, indexContent, "utf8");
    console.log(`\n📋 生成索引文件: ${indexPath}`);

    console.log(`\n✅ 完成：共生成 ${totalBatches} 个批次的任务文件`);
    console.log(`\n下一步：`);
    console.log(`1. 打开 ${PROMPT_OUTPUT_DIR} 目录中的 prompt 文件`);
    console.log(`2. 使用Cursor的AI功能处理这些文件`);
    console.log(`3. 将结果保存为 result-batch-*.json`);
    console.log(`4. 运行 apply 命令应用标签`);

    return;
  }

  // 命令2: apply - 应用标签结果
  if (command === "apply") {
    const batchFile = args[1];
    const resultFile = args[2];

    if (!batchFile || !resultFile) {
      console.error("❌ 用法: npx tsx scripts/auto-tag-questions.ts apply <批次文件> <结果文件>");
      console.error("   例如: npx tsx scripts/auto-tag-questions.ts apply src/data/questions/zhbp/questions-batch-1.json src/data/questions/zhbp/result-batch-1.json");
      console.error("   或者: npx tsx scripts/auto-tag-questions.ts apply <源文件> <结果文件> (单文件模式)");
      process.exit(1);
    }

    const batchPath = path.isAbsolute(batchFile) ? batchFile : path.resolve(process.cwd(), batchFile);
    const resultPath = path.isAbsolute(resultFile) ? resultFile : path.resolve(process.cwd(), resultFile);

    if (!fs.existsSync(resultPath)) {
      console.error(`❌ 结果文件不存在: ${resultPath}`);
      process.exit(1);
    }

    try {
      // 检查是否是批次文件（questions-batch-*.json）
      if (batchPath.includes("questions-batch-") && fs.existsSync(batchPath)) {
        // 批量模式：应用到所有相关源文件
        applyTagsFromBatchResult(batchPath, resultPath);
      } else if (fs.existsSync(batchPath)) {
        // 单文件模式：应用到指定源文件
        applyTagsFromResult(batchPath, resultPath);
      } else {
        console.error(`❌ 批次文件或源文件不存在: ${batchPath}`);
        process.exit(1);
      }
      console.log(`\n✅ 标签应用完成`);
    } catch (error) {
      console.error(`❌ 应用标签失败:`, error);
      process.exit(1);
    }

    return;
  }

  // 默认：显示帮助
  console.log(`
📚 题目自动打标签工具

用法:
  npx tsx scripts/auto-tag-questions.ts <command> [options]

命令:
  generate                   生成包含题目和prompt的文件，供Cursor的agent处理
  apply <源文件> <结果文件>  将Cursor agent处理后的标签结果应用到原文件

示例:
  # 生成prompt文件
  npx tsx scripts/auto-tag-questions.ts generate

  # 应用标签结果
  npx tsx scripts/auto-tag-questions.ts apply src/data/questions/zhb/12.json scripts/tagging-prompts/result-batch-1.json

工作流程:
  1. 运行 generate 命令生成prompt文件
  2. 使用Cursor的AI功能处理prompt文件，生成标签JSON
  3. 将标签JSON保存为result文件
  4. 运行 apply 命令将标签应用到原文件
`);
}

main().catch((err) => {
  console.error("❌ 程序异常结束:", err);
  process.exit(1);
});
