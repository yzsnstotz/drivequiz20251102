/**
 * 驾照类型多语言显示名称映射
 */

export const LICENSE_TYPE_LABELS: Record<
  string,
  { zh: string; ja: string; en: string }
> = {
  ordinary: {
    zh: "普通免許",
    ja: "普通免許",
    en: "Ordinary License",
  },
  semi_medium: {
    zh: "準中型免許",
    ja: "準中型免許",
    en: "Semi-Medium License",
  },
  medium: {
    zh: "中型免許",
    ja: "中型免許",
    en: "Medium License",
  },
  large: {
    zh: "大型免許",
    ja: "大型免許",
    en: "Large License",
  },
  moped: {
    zh: "原付",
    ja: "原付",
    en: "Moped",
  },
  motorcycle_std: {
    zh: "普通二輪",
    ja: "普通二輪",
    en: "Standard Motorcycle",
  },
  motorcycle_large: {
    zh: "大型二輪",
    ja: "大型二輪",
    en: "Large Motorcycle",
  },
  ordinary_2: {
    zh: "普通二種",
    ja: "普通二種",
    en: "Ordinary Second Class",
  },
  medium_2: {
    zh: "中型二種",
    ja: "中型二種",
    en: "Medium Second Class",
  },
  large_2: {
    zh: "大型二種",
    ja: "大型二種",
    en: "Large Second Class",
  },
  trailer: {
    zh: "けん引",
    ja: "けん引",
    en: "Trailer",
  },
  large_special: {
    zh: "大型特殊",
    ja: "大型特殊",
    en: "Large Special",
  },
  foreign_exchange: {
    zh: "外免切替",
    ja: "外免切替",
    en: "Foreign License Exchange",
  },
  reacquire: {
    zh: "再取得",
    ja: "再取得",
    en: "Reacquire",
  },
  provisional_only: {
    zh: "仮免のみ",
    ja: "仮免のみ",
    en: "Provisional Only",
  },
  common_all: {
    zh: "共通",
    ja: "共通",
    en: "Common (All)",
  },
};

/**
 * 根据当前语言获取驾照类型的显示名称
 * @param licenseTypeTag 驾照类型标签
 * @param language 语言代码 ('zh' | 'en' | 'ja')
 * @returns 显示名称，如果不存在则返回标签本身
 */
export function getLicenseTypeLabel(
  licenseTypeTag: string,
  language: "zh" | "en" | "ja" = "zh"
): string {
  const label = LICENSE_TYPE_LABELS[licenseTypeTag];
  if (!label) return licenseTypeTag;
  return label[language] || label.zh;
}

