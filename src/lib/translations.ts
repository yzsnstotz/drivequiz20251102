/**
 * 翻译映射表
 * 将字符串 key 映射到多语言对象
 */

import { Language } from "./i18n";

export type TranslationKey = string;

export interface TranslationValue {
  ja?: string;
  zh?: string;
  en?: string;
  default?: string;
}

/**
 * 翻译映射表
 */
const translations: Record<string, TranslationValue> = {
  // Common translations
  "common.confirm": {
    ja: "確認",
    zh: "确认",
    en: "Confirm",
    default: "确认",
  },
  "common.delete": {
    ja: "削除",
    zh: "删除",
    en: "Delete",
    default: "删除",
  },
  "common.loading": {
    ja: "読み込み中...",
    zh: "加载中...",
    en: "Loading...",
    default: "加载中...",
  },
  "common.create": {
    ja: "作成",
    zh: "创建",
    en: "Create",
    default: "创建",
  },
  "common.save": {
    ja: "保存",
    zh: "保存",
    en: "Save",
    default: "保存",
  },
  "common.cancel": {
    ja: "キャンセル",
    zh: "取消",
    en: "Cancel",
    default: "取消",
  },
  "common.edit": {
    ja: "編集",
    zh: "编辑",
    en: "Edit",
    default: "编辑",
  },
  "common.actions": {
    ja: "操作",
    zh: "操作",
    en: "Actions",
    default: "操作",
  },
  // Header translations
  "header.title": {
    ja: "ZALEM 管理画面",
    zh: "ZALEM 管理后台",
    en: "ZALEM Admin",
    default: "ZALEM 管理后台",
  },
  "header.changePassword": {
    ja: "パスワード変更",
    zh: "修改密码",
    en: "Change Password",
    default: "修改密码",
  },
  "header.logout": {
    ja: "ログアウト",
    zh: "退出登录",
    en: "Logout",
    default: "退出登录",
  },
  // Merchants translations
  "merchants.title": {
    ja: "業者管理",
    zh: "商家管理",
    en: "Merchants",
    default: "商家管理",
  },
  "merchants.create": {
    ja: "業者作成",
    zh: "创建商家",
    en: "Create Merchant",
    default: "创建商家",
  },
  "merchants.name": {
    ja: "名前",
    zh: "名称",
    en: "Name",
    default: "名称",
  },
  "merchants.description": {
    ja: "説明",
    zh: "描述",
    en: "Description",
    default: "描述",
  },
  "merchants.address": {
    ja: "住所",
    zh: "地址",
    en: "Address",
    default: "地址",
  },
  "merchants.phone": {
    ja: "電話番号",
    zh: "电话",
    en: "Phone",
    default: "电话",
  },
  "merchants.email": {
    ja: "メール",
    zh: "邮箱",
    en: "Email",
    default: "邮箱",
  },
  "merchants.status": {
    ja: "ステータス",
    zh: "状态",
    en: "Status",
    default: "状态",
  },
  "merchants.active": {
    ja: "有効",
    zh: "启用",
    en: "Active",
    default: "启用",
  },
  "merchants.inactive": {
    ja: "無効",
    zh: "禁用",
    en: "Inactive",
    default: "禁用",
  },
  "merchants.list": {
    ja: "業者一覧",
    zh: "商家列表",
    en: "Merchants List",
    default: "商家列表",
  },
  // Videos translations
  "videos.title": {
    ja: "動画管理",
    zh: "视频管理",
    en: "Videos",
    default: "视频管理",
  },
  "videos.create": {
    ja: "動画作成",
    zh: "创建视频",
    en: "Create Video",
    default: "创建视频",
  },
  "videos.titleField": {
    ja: "タイトル",
    zh: "标题",
    en: "Title",
    default: "标题",
  },
  "videos.description": {
    ja: "説明",
    zh: "描述",
    en: "Description",
    default: "描述",
  },
  "videos.url": {
    ja: "URL",
    zh: "链接",
    en: "URL",
    default: "链接",
  },
  "videos.thumbnail": {
    ja: "サムネイル",
    zh: "缩略图",
    en: "Thumbnail",
    default: "缩略图",
  },
  "videos.category": {
    ja: "カテゴリ",
    zh: "分类",
    en: "Category",
    default: "分类",
  },
  "videos.categoryBasic": {
    ja: "基礎",
    zh: "基础",
    en: "Basic",
    default: "基础",
  },
  "videos.categoryAdvanced": {
    ja: "応用",
    zh: "进阶",
    en: "Advanced",
    default: "进阶",
  },
  "videos.list": {
    ja: "動画一覧",
    zh: "视频列表",
    en: "Videos List",
    default: "视频列表",
  },
  // Nav translations
  "nav.activationCodes": {
    ja: "アクティベーションコード",
    zh: "激活码",
    en: "Activation Codes",
    default: "激活码",
  },
  "nav.users": {
    ja: "ユーザー",
    zh: "用户",
    en: "Users",
    default: "用户",
  },
  "nav.questions": {
    ja: "問題",
    zh: "题目",
    en: "Questions",
    default: "题目",
  },
  "nav.admins": {
    ja: "管理者",
    zh: "管理员",
    en: "Admins",
    default: "管理员",
  },
  "nav.operationLogs": {
    ja: "操作ログ",
    zh: "操作日志",
    en: "Operation Logs",
    default: "操作日志",
  },
  "nav.stats": {
    ja: "統計",
    zh: "统计",
    en: "Statistics",
    default: "统计",
  },
  "nav.tasks": {
    ja: "タスク",
    zh: "任务",
    en: "Tasks",
    default: "任务",
  },
  "nav.merchants": {
    ja: "業者",
    zh: "商家",
    en: "Merchants",
    default: "商家",
  },
  "nav.adSlots": {
    ja: "広告欄",
    zh: "广告栏",
    en: "Ad Slots",
    default: "广告栏",
  },
  "nav.adContents": {
    ja: "広告コンテンツ",
    zh: "广告内容",
    en: "Ad Contents",
    default: "广告内容",
  },
  "nav.videos": {
    ja: "動画",
    zh: "视频",
    en: "Videos",
    default: "视频",
  },
  "nav.contactAndTerms": {
    ja: "連絡先と利用規約",
    zh: "联系方式和条款",
    en: "Contact & Terms",
    default: "联系方式和条款",
  },
  "nav.ai": {
    ja: "AI管理",
    zh: "AI管理",
    en: "AI Management",
    default: "AI管理",
  },
};

/**
 * 获取翻译值
 */
export function getTranslation(key: string): TranslationValue | undefined {
  return translations[key];
}

/**
 * 检查翻译 key 是否存在
 */
export function hasTranslation(key: string): boolean {
  return key in translations;
}

