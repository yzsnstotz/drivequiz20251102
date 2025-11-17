/**
 * 题目标签系统统一定义
 * 
 * 本文件定义了题目标签系统的三个维度：
 * 1. license_type_tag: 驾照类型（单个值）
 * 2. stage_tag: 考试阶段（单个值）
 * 3. topic_tags: 知识主题（数组，1-2个）
 * 
 * 重要：这三个维度是互相独立的，不要混用。
 */

// ============================================================
// 1. license_type_tag（驾照类型）
// ============================================================

export const LICENSE_TYPE_TAGS = [
  "ordinary",          // 普通免許
  "semi_medium",       // 準中型免許
  "medium",            // 中型免許
  "large",             // 大型免許
  "moped",             // 原付（原動機付自転車）
  "motorcycle_std",    // 普通二輪
  "motorcycle_large",  // 大型二輪
  "ordinary_2",        // 普通二種
  "medium_2",          // 中型二種
  "large_2",           // 大型二種
  "trailer",           // けん引
  "large_special",     // 大型特殊
  "foreign_exchange",  // 外国免許切替相关题目
  "reacquire",         // 再取得試験特有题目
  "provisional_only",  // 仅仮免阶段会出现的题目
  "common_all",        // 所有驾照类型都需要掌握的基础题目
] as const;

export type LicenseTypeTag = (typeof LICENSE_TYPE_TAGS)[number];

/**
 * 校验是否为合法的驾照类型标签
 */
export function isLicenseTypeTag(v: unknown): v is LicenseTypeTag {
  return typeof v === "string" && (LICENSE_TYPE_TAGS as readonly string[]).includes(v);
}

// ============================================================
// 2. stage_tag（考试阶段）
// ============================================================

export const STAGE_TAGS = ["provisional", "full", "both"] as const;

export type StageTag = (typeof STAGE_TAGS)[number];

/**
 * 校验是否为合法的阶段标签
 */
export function isStageTag(v: unknown): v is StageTag {
  return typeof v === "string" && (STAGE_TAGS as readonly string[]).includes(v);
}

// ============================================================
// 3. topic_tags（知识主题）
// ============================================================

export const TOPIC_TAGS = [
  "signs_and_markings",        // 标志・标线（道路标志、路面标线）
  "signals",                   // 信号灯（信号机、右转箭头、黄灯含义等）
  "right_of_way",              // 优先权 & 交叉路口（让行、优先道路、一时停止）
  "overtake_lane_change",      // 超车与变道（超车禁止、右侧车道使用等）
  "parking_stopping",          // 停车・停靠（停车禁止、临时停车、路边停车）
  "pedestrians_bicycles",      // 行人・自行车・轻车相关规则
  "driving_posture_operation", // 驾驶姿势与操作方法（起步、换挡、握方向盘等）
  "speed_distance_following",  // 车速、车距、安全间隔
  "weather_night_highway",     // 恶劣天气、夜间驾驶、高速公路行驶
  "accident_emergency",        // 事故发生后的处理与紧急应对
  "penalties_points",          // 罚则与扣分制度
  "vehicle_maintenance",       // 车辆构造、日常检查与维护
  "commercial_passenger",      // 二種免許・营运载客特有规则
  "large_truck_special",       // 大型货车・装载限制・制动距离等特例
  "motorcycle_specific",       // 二輪・原付特有规则（倾斜、二段右转等）
  "exam_procedure",           // 考试流程、评分标准、考试场地规则
  "other",                    // 不属于以上任何分类时使用
] as const;

export type TopicTag = (typeof TOPIC_TAGS)[number];

/**
 * 校验是否为合法的主题标签
 */
export function isTopicTag(v: unknown): v is TopicTag {
  return typeof v === "string" && (TOPIC_TAGS as readonly string[]).includes(v);
}

// ============================================================
// 4. AI 返回结果类型定义
// ============================================================

/**
 * AI 自动打标签的返回结果（原始格式）
 */
export interface QuestionTagsAIResult {
  licenseTypeTag: string | string[]; // 可以是单个值或数组
  stageTag: string;
  topicTags: string[]; // 长度 1~2
}

/**
 * 规范化后的题目标签结果
 */
export interface NormalizedQuestionTags {
  licenseTypeTag: LicenseTypeTag[]; // 数组，可包含多个驾照类型
  stageTag: StageTag;
  topicTags: TopicTag[]; // 长度 1~2
}

/**
 * 规范化 AI 返回的标签结果
 * 
 * @param raw AI 返回的原始结果
 * @returns 规范化后的标签结果，包含默认值兜底
 */
export function normalizeAIResult(raw: any): NormalizedQuestionTags {
  const licenseTypes: LicenseTypeTag[] = [];
  let stage: StageTag = "both";
  const topics: TopicTag[] = [];

  if (raw && typeof raw === "object") {
    // 校验并设置 licenseTypeTag（支持单个值或数组）
    if (Array.isArray(raw.licenseTypeTag)) {
      // 如果是数组，校验每个元素
      for (const tag of raw.licenseTypeTag) {
        if (isLicenseTypeTag(tag)) {
          licenseTypes.push(tag);
        }
      }
    } else if (isLicenseTypeTag(raw.licenseTypeTag)) {
      // 如果是单个值，转换为数组
      licenseTypes.push(raw.licenseTypeTag);
    }

    // 校验并设置 stageTag
    if (isStageTag(raw.stageTag)) {
      stage = raw.stageTag;
    }

    // 校验并设置 topicTags（最多 2 个）
    if (Array.isArray(raw.topicTags)) {
      for (const t of raw.topicTags) {
        if (isTopicTag(t) && topics.length < 2) {
          topics.push(t);
        }
      }
    }
  }

  // 如果没有合法 licenseTypeTag，则兜底为 ["common_all"]
  if (licenseTypes.length === 0) {
    licenseTypes.push("common_all");
  }

  // 如果没有合法 topic，则兜底为 ["other"]
  if (topics.length === 0) {
    topics.push("other");
  }

  return {
    licenseTypeTag: licenseTypes, // 返回数组
    stageTag: stage,
    topicTags: topics.slice(0, 2), // 限制最多 2 个
  };
}

