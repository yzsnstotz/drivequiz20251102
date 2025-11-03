/**
 * ZALEM · AI 问答模块 · 安全审查库
 * - 单点集中安全规则，便于多路由复用
 * - 支持模式切换（normal/strict）
 * - TypeScript 严格模式 & ESLint/Prettier 友好
 */

export type SafetyMode = "normal" | "strict";

export interface SafetyOptions {
  /**
   * 审查强度：
   * - normal：常规审查
   * - strict：更保守，命中更多灰区（如黑客技术细节、隐私获取等）
   */
  mode?: SafetyMode;
  /** 语言或地域信息（预留，规则可按 locale 定制） */
  locale?: string;
}

/** 命中结果（不通过） */
export interface SafetyFail {
  pass: false;
  /** 规范化错误码（大写下划线） */
  code: string;
  /** 给前端/用户的友好提示 */
  message: string;
  /** 规则分类，便于日志分析 */
  category: string;
  /** 命中规则 id（用于灰度与统计） */
  ruleId: string;
}

/** 通过结果 */
export interface SafetyPass {
  pass: true;
}

export type SafetyResult = SafetyPass | SafetyFail;

/** 内部规则结构 */
interface Rule {
  id: string;
  category:
    | "self_harm"
    | "violent_wrongdoing"
    | "illegal_weapons_explosives"
    | "illegal_drugs"
    | "financial_crime"
    | "sexual_content_csam"
    | "privacy_sensitive"
    | "malware_cybersec"
    | "hate_abuse"
    | "extremism"
    | "other_safety";
  code: string; // 规范化错误码
  message: string; // 呈现给用户/前端的提示语
  pattern: RegExp; // 触发条件（小写文本上匹配）
  /** 哪些模式启用该规则（默认两种模式都启用） */
  modes?: SafetyMode[];
}

/** 将文本归一化（小写、去除多余空白） */
function normalizeInput(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 基础规则清单（可表驱动：后续可改为从数据库或配置拉取）
 * - 注意：正则只在 normalize 后的小写文本上匹配
 * - 这里覆盖高危与合规重点；strict 模式会额外开启更多规则
 */
const BASE_RULES: Rule[] = [
  // 自残/自杀
  {
    id: "r_selfharm_001",
    category: "self_harm",
    code: "SAFETY_BLOCKED",
    message: "为保护你的安全，相关内容无法提供。",
    pattern: /(自杀|轻生|suicide|kill myself|自伤|割腕|how to die)/,
  },
  // 暴力与犯罪教唆
  {
    id: "r_violence_001",
    category: "violent_wrongdoing",
    code: "SAFETY_BLOCKED",
    message: "该请求涉及违法或危险行为，无法提供帮助。",
    pattern:
      /(杀人|谋杀|行凶|kidnap|绑架|袭击|how to (?:kill|hurt) (?:someone|people)|造假证件)/,
  },
  // 爆炸物/武器制造
  {
    id: "r_weapon_001",
    category: "illegal_weapons_explosives",
    code: "SAFETY_BLOCKED",
    message: "该请求涉及爆炸物或非法武器制造，无法提供。",
    pattern:
      /(自制炸弹|爆炸物|bomb ?making|homemade (?:bomb|explosive)|tATP|硝化甘油)/,
  },
  // 非法毒品制造
  {
    id: "r_drugs_001",
    category: "illegal_drugs",
    code: "SAFETY_BLOCKED",
    message: "该请求涉及违法药物制造或使用，无法提供。",
    pattern: /(毒品制作|自制毒品|cook meth|制造冰毒|how to make (?:meth|drugs))/,
  },
  // 金融犯罪/盗刷
  {
    id: "r_fincrime_001",
    category: "financial_crime",
    code: "SAFETY_BLOCKED",
    message: "该请求涉及金融犯罪风险，无法提供。",
    pattern:
      /(信用卡盗刷|卡料|cvv|skimmer|免费获取信用卡|绕过支付|洗钱教程|money laundering)/,
  },
  // CSAM 明确拦截（零容忍）
  {
    id: "r_csam_001",
    category: "sexual_content_csam",
    code: "SAFETY_BLOCKED",
    message: "已拦截不当内容请求。",
    pattern: /(未成年人.*(性|裸|不雅)|child\s*(?:porn|sexual)|lolita\s*sex)/,
  },
  // 隐私敏感（strict 模式更严格）
  {
    id: "r_privacy_001",
    category: "privacy_sensitive",
    code: "SENSITIVE_PRIVACY",
    message: "该请求涉及敏感隐私数据，无法提供。",
    pattern: /(获取.*(身份证|护照|住址|手机号).*数据库|脱敏前数据|泄露数据库)/,
    modes: ["strict"],
  },
  // 恶意代码/攻击面（strict 模式严拦；正常模式可保留高危关键词）
  {
    id: "r_malware_001",
    category: "malware_cybersec",
    code: "MALWARE_BLOCKED",
    message: "该请求可能涉及恶意代码或攻击行为，无法提供。",
    pattern:
      /(制作病毒|木马植入|ransomware|ddos\s*攻击|零日利用|0day exploit|键盘记录器)/,
    modes: ["strict"],
  },
  // 仇恨/滥用（可结合更细分类策略）
  {
    id: "r_hate_001",
    category: "hate_abuse",
    code: "SAFETY_BLOCKED",
    message: "该请求包含不当或仇恨内容，无法提供。",
    pattern: /(灭绝.*(群体|民族)|种族.*优越|hate\s*speech)/,
  },
  // 极端主义宣传
  {
    id: "r_extrem_001",
    category: "extremism",
    code: "SAFETY_BLOCKED",
    message: "该请求涉及极端主义/恐怖主义宣传，无法提供。",
    pattern: /(加入.*(恐怖组织|极端组织)|制作宣言.*(恐怖|极端))/,
  },
  // 其他通用安全兜底
  {
    id: "r_other_001",
    category: "other_safety",
    code: "SAFETY_BLOCKED",
    message: "该请求可能存在安全或合规风险，无法提供。",
    pattern: /(如何规避.*(监管|合规)|黑市交易|暗网购买|dark web\s*(?:buy|market))/,
  },
];

/**
 * 根据模式筛选生效规则
 */
function getActiveRules(mode: SafetyMode): Rule[] {
  return BASE_RULES.filter((r) => {
    if (!r.modes) return true;
    return r.modes.includes(mode);
  });
}

/**
 * 安全审查主函数
 * - 命中任一规则即返回不通过
 * - 未来可扩展为返回多条命中（目前先命中即返）
 */
export function checkSafety(
  text: string,
  options?: SafetyOptions,
): SafetyResult {
  const mode: SafetyMode = options?.mode ?? "normal";
  const normalized = normalizeInput(text);

  if (!normalized) {
    // 空文本按通过处理，交给上层做必填校验
    return { pass: true };
  }

  const rules = getActiveRules(mode);
  for (const rule of rules) {
    if (rule.pattern.test(normalized)) {
      return {
        pass: false,
        code: rule.code,
        message: rule.message,
        category: rule.category,
        ruleId: rule.id,
      };
    }
  }

  return { pass: true };
}
