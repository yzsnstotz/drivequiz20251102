/**
 * 内容安全与分类模块（本地规则版）
 * - checkSafety(text): 进行基础安全拦截（色情/暴力/仇恨/违法/自残/隐私）
 * - classifyTopic(text): 轻量主题分类（交通/驾考优先，其它归为 general）
 * 说明：不依赖外部服务，后续可接入更强模型做细分；本地规则优先“宁可少放、不可误放”。
 */

export type SafetyCategory =
  | "sexual"
  | "violence"
  | "hate"
  | "self_harm"
  | "illegal"
  | "privacy"
  | "spam"
  | "malware"
  | "unknown";

export type SafetyCheckResult = {
  ok: boolean;
  message?: string;
  category?: SafetyCategory;
};

export type Topic =
  | "driving_law"
  | "traffic_sign"
  | "driving_skill"
  | "admin_policy"
  | "general";

/** 低成本词典（可扩展） */
const WORDS = {
  sexual: [
    "性爱",
    "色情",
    "裸照",
    "av ",
    "成人片",
    "约炮",
    "口交",
    "肛交",
    "强奸",
    "乱伦",
    "未成年人性",
  ],
  violence: [
    "杀人",
    "自制爆炸物",
    "爆炸物",
    "砍杀",
    "恐袭",
    "恐怖袭击",
    "血腥",
    "处决",
    "制炸弹",
  ],
  hate: ["种族优越", "仇恨言论", "去死", "滚回", "灭绝某族群"],
  self_harm: ["自杀", "轻生", "割腕", "服毒", "上吊", "如何自残"],
  illegal: [
    "买枪",
    "贩毒",
    "吸毒教程",
    "假币",
    "走私",
    "翻墙工具出售",
    "洗钱",
    "诈骗教程",
    "开锁教程",
  ],
  malware: ["木马源码", "勒索软件", "后门程序", "如何入侵", "键盘记录器"],
  spam: ["批量引流", "爆粉", "裂变加群", "私信轰炸", "刷量工具"],
};

/** 隐私/敏感信息的基础检测 */
const PII_PATTERNS: RegExp[] = [
  /\b\d{3,4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // bank/credit (粗略)
  /\b(?:\d{10,12}|[A-Z0-9]{8,12})\b/, // id-like 兜底
  /\b\d{2,4}[-/年]\d{1,2}[-/月]\d{1,2}日?\b/, // birthday-like
  /\b(?:\+?\d{1,3}[-\s]?)?(?:\d{2,4}[-\s]?){2,3}\d{2,4}\b/, // phone-like
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, // email
  /\b\d{7}\b/, // Japan postal code-like
  /\b\d{3}-\d{4}\b/, // JP zip
  /\b(?:住所|住址|现住址|地址)[:：]/, // address cue
];

/** 将文本标准化为低噪声形式 */
function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** 命中词典检测 */
function hitDict(text: string): SafetyCategory | null {
  const t = normalize(text);
  const dict: [SafetyCategory, string[]][] = [
    ["sexual", WORDS.sexual],
    ["violence", WORDS.violence],
    ["hate", WORDS.hate],
    ["self_harm", WORDS.self_harm],
    ["illegal", WORDS.illegal],
    ["malware", WORDS.malware],
    ["spam", WORDS.spam],
  ];
  for (const [cat, arr] of dict) {
    for (const w of arr) {
      if (t.includes(w.toLowerCase())) return cat;
    }
  }
  return null;
}

/** PII 检测（粗略规则，命中即拦截） */
function hasPII(text: string): boolean {
  const raw = text || "";
  return PII_PATTERNS.some((re) => re.test(raw));
}

/**
 * 对外：内容安全检测
 * 命中任一高危类别或含敏感隐私 → 拒答
 */
export async function checkSafety(input: string): Promise<SafetyCheckResult> {
  try {
    const text = (input || "").slice(0, 4000);
    if (!text.trim()) {
      return { ok: false, category: "unknown", message: "Empty content" };
    }

    if (hasPII(text)) {
      return {
        ok: false,
        category: "privacy",
        message: "请求包含敏感个人信息，已被拦截。",
      };
    }

    const cat = hitDict(text);
    if (cat) {
      const messages: Record<SafetyCategory, string> = {
        sexual: "涉及成人/性相关内容，无法提供帮助。",
        violence: "涉及暴力与极端伤害内容，无法提供帮助。",
        hate: "涉及仇恨或歧视性内容，无法提供帮助。",
        self_harm: "涉及自残/自杀等高风险内容，建议寻求专业帮助。",
        illegal: "涉及违法犯罪的方法或操作，无法提供帮助。",
        privacy: "请求包含敏感个人信息，无法提供。",
        spam: "疑似垃圾/批量引流内容，无法提供帮助。",
        malware: "涉及恶意软件或入侵指导，无法提供帮助。",
        unknown: "内容不被允许。",
      };
      return { ok: false, category: cat, message: messages[cat] };
    }

    // 通过
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      category: "unknown",
      message: (e as Error).message || "Safety check failed",
    };
  }
}

/**
 * 主题轻分类（便于上游检索加权或路由）
 * 非严格：关键词法优先覆盖驾考相关主题
 */
export function classifyTopic(text: string): Topic {
  const t = normalize(text);
  if (
    /(交通标志|標識|標識|道路標識|交通標識|traffic sign|road sign)/i.test(t)
  ) {
    return "traffic_sign";
  }
  if (/(酒驾|酒駕|飲酒運転|酒気帯び|信号灯|停车让行|优先权|优先道)/i.test(t)) {
    return "driving_law";
  }
  if (/(并线|變道|转向|駐車|坡道起步|雨天行车|夜间行车|跟车距离)/i.test(t)) {
    return "driving_skill";
  }
  if (/(报名|预约|更换驾照|变更住址|住所変更|学科考试|技能考试|受験)/i.test(t)) {
    return "admin_policy";
  }
  return "general";
}
