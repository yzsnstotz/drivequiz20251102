export type Language = 'zh' | 'en' | 'ja';

export interface Translations {
  zh: Record<string, string>;
  en: Record<string, string>;
  ja: Record<string, string>;
}

// 管理后台翻译
export const adminTranslations: Translations = {
  zh: {
    // 导航菜单
    'nav.dashboard': 'Dashboard',
    'nav.activationCodes': '激活码',
    'nav.users': '用户',
    'nav.questions': '题目',
    'nav.admins': '管理员',
    'nav.operationLogs': '操作日志',
    'nav.stats': '统计',
    'nav.tasks': '任务',
    'nav.merchants': '商户管理',
    'nav.merchantCategories': '商户类型',
    'nav.adSlots': '广告栏管理',
    'nav.videos': '视频管理',
    'nav.contactAndTerms': '联系与条款',
    'nav.ai': 'AI 总览',
    
    // 顶部栏
    'header.title': 'ZALEM Admin',
    'header.changePassword': '修改密码',
    'header.logout': '退出',
    
    // 通用
    'common.loading': '加载中...',
    'common.error': '错误',
    'common.success': '成功',
    'common.confirm': '确认',
    'common.cancel': '取消',
    'common.save': '保存',
    'common.delete': '删除',
    'common.edit': '编辑',
    'common.create': '创建',
    'common.search': '搜索',
    'common.actions': '操作',
    'common.refresh': '刷新',
    'common.submit': '提交',
    'common.back': '返回',
    'common.yes': '是',
    'common.no': '否',
    
    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.subtitle': '激活码管理概览',
    'dashboard.totalCodes': '激活码总数',
    'dashboard.enabled': '已启用',
    'dashboard.expired': '已过期',
    'dashboard.usageRate': '使用率',
    'dashboard.statusDistribution': '状态分布',
    'dashboard.usageStats': '使用情况',
    'dashboard.quickActions': '快速操作',
    'dashboard.generateCode': '生成激活码',
    'dashboard.viewCodes': '查看激活码列表',
    'dashboard.viewUsers': '查看用户',
    'dashboard.detailedStats': '详细统计',
    'dashboard.taskManagement': '任务管理',
    'dashboard.disabled': '未启用',
    'dashboard.suspended': '挂起',
    'dashboard.used': '已使用',
    'dashboard.unused': '未使用',
    
    // 激活码管理
    'activationCodes.title': '激活码管理',
    'activationCodes.create': '创建激活码',
    'activationCodes.edit': '编辑激活码',
    'activationCodes.list': '激活码列表',
    'activationCodes.status': '状态',
    'activationCodes.code': '激活码',
    'activationCodes.usageLimit': '使用限制',
    'activationCodes.usedCount': '已使用',
    'activationCodes.createdAt': '创建时间',
    'activationCodes.expiresAt': '过期时间',
    'activationCodes.notes': '备注',
    
    // 用户管理
    'users.title': '用户管理',
    'users.list': '用户列表',
    'users.email': '邮箱',
    'users.activatedAt': '激活时间',
    'users.lastActivation': '最后激活',
    
    // 题目管理
    'questions.title': '题库管理',
    'questions.create': '创建题目',
    'questions.edit': '编辑题目',
    'questions.downloadTemplate': '下载模板',
    'questions.batchImport': '批量导入',
    'questions.importing': '导入中...',
    
    // 管理员管理
    'admins.title': '管理员管理',
    'admins.create': '创建管理员',
    'admins.edit': '编辑管理员',
    'admins.username': '用户名',
    'admins.password': '密码',
    'admins.isDefault': '默认管理员',
    
    // 操作日志
    'logs.title': '操作日志',
    'logs.action': '操作',
    'logs.admin': '管理员',
    'logs.timestamp': '时间',
    'logs.details': '详情',
    
    // 统计
    'stats.title': '统计',
    'stats.overview': '概览',
    
    // 任务
    'tasks.title': '任务管理',
    
    // 商户管理
    'merchants.title': '商户管理',
    'merchants.list': '商户列表',
    'merchants.create': '创建商户',
    'merchants.edit': '编辑商户',
    'merchants.name': '商户名称',
    'merchants.description': '商户描述',
    'merchants.address': '地址',
    'merchants.phone': '电话',
    'merchants.email': '邮箱',
    'merchants.status': '状态',
    'merchants.active': '启用',
    'merchants.inactive': '禁用',
    
    // 视频管理
    'videos.title': '视频管理',
    'videos.list': '视频列表',
    'videos.create': '创建视频',
    'videos.edit': '编辑视频',
    'videos.titleField': '标题',
    'videos.description': '描述',
    'videos.url': '视频URL',
    'videos.thumbnail': '缩略图',
    'videos.category': '分类',
    'videos.categoryBasic': '本免许学试',
    'videos.categoryAdvanced': '二种免许学试',
    'videos.order': '排序',
    'videos.status': '状态',
  },
  en: {
    // 导航菜单
    'nav.dashboard': 'Dashboard',
    'nav.activationCodes': 'Activation Codes',
    'nav.users': 'Users',
    'nav.questions': 'Questions',
    'nav.admins': 'Admins',
    'nav.operationLogs': 'Operation Logs',
    'nav.stats': 'Stats',
    'nav.tasks': 'Tasks',
    'nav.merchants': 'Merchants',
    'nav.merchantCategories': 'Merchant Categories',
    'nav.adSlots': 'Ad Slots',
    'nav.videos': 'Videos',
    'nav.contactAndTerms': 'Contact & Terms',
    'nav.ai': 'AI Overview',
    
    // 顶部栏
    'header.title': 'ZALEM Admin',
    'header.changePassword': 'Change Password',
    'header.logout': 'Logout',
    
    // 通用
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.search': 'Search',
    'common.actions': 'Actions',
    'common.refresh': 'Refresh',
    'common.submit': 'Submit',
    'common.back': 'Back',
    'common.yes': 'Yes',
    'common.no': 'No',
    
    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.subtitle': 'Activation Code Management Overview',
    'dashboard.totalCodes': 'Total Codes',
    'dashboard.enabled': 'Enabled',
    'dashboard.expired': 'Expired',
    'dashboard.usageRate': 'Usage Rate',
    'dashboard.statusDistribution': 'Status Distribution',
    'dashboard.usageStats': 'Usage Statistics',
    'dashboard.quickActions': 'Quick Actions',
    'dashboard.generateCode': 'Generate Code',
    'dashboard.viewCodes': 'View Codes List',
    'dashboard.viewUsers': 'View Users',
    'dashboard.detailedStats': 'Detailed Stats',
    'dashboard.taskManagement': 'Task Management',
    'dashboard.disabled': 'Disabled',
    'dashboard.suspended': 'Suspended',
    'dashboard.used': 'Used',
    'dashboard.unused': 'Unused',
    
    // 激活码管理
    'activationCodes.title': 'Activation Codes',
    'activationCodes.create': 'Create Code',
    'activationCodes.edit': 'Edit Code',
    'activationCodes.list': 'Codes List',
    'activationCodes.status': 'Status',
    'activationCodes.code': 'Code',
    'activationCodes.usageLimit': 'Usage Limit',
    'activationCodes.usedCount': 'Used',
    'activationCodes.createdAt': 'Created At',
    'activationCodes.expiresAt': 'Expires At',
    'activationCodes.notes': 'Notes',
    
    // 用户管理
    'users.title': 'Users',
    'users.list': 'Users List',
    'users.email': 'Email',
    'users.activatedAt': 'Activated At',
    'users.lastActivation': 'Last Activation',
    
    // 题目管理
    'questions.title': 'Questions',
    'questions.create': 'Create Question',
    'questions.edit': 'Edit Question',
    'questions.downloadTemplate': 'Download Template',
    'questions.batchImport': 'Batch Import',
    'questions.importing': 'Importing...',
    
    // 管理员管理
    'admins.title': 'Admins',
    'admins.create': 'Create Admin',
    'admins.edit': 'Edit Admin',
    'admins.username': 'Username',
    'admins.password': 'Password',
    'admins.isDefault': 'Default Admin',
    
    // 操作日志
    'logs.title': 'Operation Logs',
    'logs.action': 'Action',
    'logs.admin': 'Admin',
    'logs.timestamp': 'Timestamp',
    'logs.details': 'Details',
    
    // 统计
    'stats.title': 'Stats',
    'stats.overview': 'Overview',
    
    // 任务
    'tasks.title': 'Tasks',
    
    // 商户管理
    'merchants.title': 'Merchants',
    'merchants.list': 'Merchants List',
    'merchants.create': 'Create Merchant',
    'merchants.edit': 'Edit Merchant',
    'merchants.name': 'Merchant Name',
    'merchants.description': 'Description',
    'merchants.address': 'Address',
    'merchants.phone': 'Phone',
    'merchants.email': 'Email',
    'merchants.status': 'Status',
    'merchants.active': 'Active',
    'merchants.inactive': 'Inactive',
    
    // 视频管理
    'videos.title': 'Videos',
    'videos.list': 'Videos List',
    'videos.create': 'Create Video',
    'videos.edit': 'Edit Video',
    'videos.titleField': 'Title',
    'videos.description': 'Description',
    'videos.url': 'Video URL',
    'videos.thumbnail': 'Thumbnail',
    'videos.category': 'Category',
    'videos.categoryBasic': 'Basic License Test',
    'videos.categoryAdvanced': 'Advanced License Test',
    'videos.order': 'Order',
    'videos.status': 'Status',
  },
  ja: {
    // 导航菜单
    'nav.dashboard': 'ダッシュボード',
    'nav.activationCodes': 'アクティベーションコード',
    'nav.users': 'ユーザー',
    'nav.questions': '問題',
    'nav.admins': '管理者',
    'nav.operationLogs': '操作ログ',
    'nav.stats': '統計',
    'nav.tasks': 'タスク',
    'nav.merchants': '店舗管理',
    'nav.merchantCategories': '店舗タイプ',
    'nav.adSlots': '広告欄管理',
    'nav.videos': '動画管理',
    'nav.contactAndTerms': '連絡と規約',
    'nav.ai': 'AI 概要',
    
    // 顶部栏
    'header.title': 'ZALEM Admin',
    'header.changePassword': 'パスワード変更',
    'header.logout': 'ログアウト',
    
    // 通用
    'common.loading': '読み込み中...',
    'common.error': 'エラー',
    'common.success': '成功',
    'common.confirm': '確認',
    'common.cancel': 'キャンセル',
    'common.save': '保存',
    'common.delete': '削除',
    'common.edit': '編集',
    'common.create': '作成',
    'common.search': '検索',
    'common.actions': '操作',
    'common.refresh': '更新',
    'common.submit': '送信',
    'common.back': '戻る',
    'common.yes': 'はい',
    'common.no': 'いいえ',
    
    // Dashboard
    'dashboard.title': 'ダッシュボード',
    'dashboard.subtitle': 'アクティベーションコード管理概要',
    'dashboard.totalCodes': 'コード総数',
    'dashboard.enabled': '有効',
    'dashboard.expired': '期限切れ',
    'dashboard.usageRate': '使用率',
    'dashboard.statusDistribution': 'ステータス分布',
    'dashboard.usageStats': '使用状況',
    'dashboard.quickActions': 'クイックアクション',
    'dashboard.generateCode': 'コード生成',
    'dashboard.viewCodes': 'コード一覧',
    'dashboard.viewUsers': 'ユーザー一覧',
    'dashboard.detailedStats': '詳細統計',
    'dashboard.taskManagement': 'タスク管理',
    'dashboard.disabled': '無効',
    'dashboard.suspended': '一時停止',
    'dashboard.used': '使用済み',
    'dashboard.unused': '未使用',
    
    // 激活码管理
    'activationCodes.title': 'アクティベーションコード',
    'activationCodes.create': 'コード作成',
    'activationCodes.edit': 'コード編集',
    'activationCodes.list': 'コード一覧',
    'activationCodes.status': 'ステータス',
    'activationCodes.code': 'コード',
    'activationCodes.usageLimit': '使用制限',
    'activationCodes.usedCount': '使用済み',
    'activationCodes.createdAt': '作成日時',
    'activationCodes.expiresAt': '有効期限',
    'activationCodes.notes': '備考',
    
    // 用户管理
    'users.title': 'ユーザー',
    'users.list': 'ユーザー一覧',
    'users.email': 'メール',
    'users.activatedAt': '有効化日時',
    'users.lastActivation': '最終有効化',
    
    // 题目管理
    'questions.title': '問題',
    'questions.create': '問題作成',
    'questions.edit': '問題編集',
    'questions.downloadTemplate': 'テンプレートダウンロード',
    'questions.batchImport': '一括インポート',
    'questions.importing': 'インポート中...',
    
    // 管理员管理
    'admins.title': '管理者',
    'admins.create': '管理者作成',
    'admins.edit': '管理者編集',
    'admins.username': 'ユーザー名',
    'admins.password': 'パスワード',
    'admins.isDefault': 'デフォルト管理者',
    
    // 操作日志
    'logs.title': '操作ログ',
    'logs.action': '操作',
    'logs.admin': '管理者',
    'logs.timestamp': 'タイムスタンプ',
    'logs.details': '詳細',
    
    // 统计
    'stats.title': '統計',
    'stats.overview': '概要',
    
    // 任务
    'tasks.title': 'タスク',
    
    // 商户管理
    'merchants.title': '店舗管理',
    'merchants.list': '店舗一覧',
    'merchants.create': '店舗作成',
    'merchants.edit': '店舗編集',
    'merchants.name': '店舗名',
    'merchants.description': '説明',
    'merchants.address': '住所',
    'merchants.phone': '電話',
    'merchants.email': 'メール',
    'merchants.status': 'ステータス',
    'merchants.active': '有効',
    'merchants.inactive': '無効',
    
    // 视频管理
    'videos.title': '動画管理',
    'videos.list': '動画一覧',
    'videos.create': '動画作成',
    'videos.edit': '動画編集',
    'videos.titleField': 'タイトル',
    'videos.description': '説明',
    'videos.url': '動画URL',
    'videos.thumbnail': 'サムネイル',
    'videos.category': 'カテゴリ',
    'videos.categoryBasic': '本免許学試',
    'videos.categoryAdvanced': '二種免許学試',
    'videos.order': '順序',
    'videos.status': 'ステータス',
  },
};

export function getTranslation(key: string, lang: Language): string {
  const translations = adminTranslations[lang];
  return translations[key] || adminTranslations.zh[key] || key;
}

// 语言存储键名
const LANGUAGE_STORAGE_KEY = 'user-language';

/**
 * 检测用户语言
 * 优先级：localStorage > 浏览器语言 > 默认中文
 */
export function detectLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'zh'; // SSR 默认返回中文
  }

  // 1. 从 localStorage 读取
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
  if (saved && ['zh', 'en', 'ja'].includes(saved)) {
    return saved;
  }

  // 2. 从浏览器语言检测
  const browserLang = navigator.language || navigator.languages?.[0] || 'zh';
  if (browserLang.startsWith('ja')) {
    return 'ja';
  }
  if (browserLang.startsWith('en')) {
    return 'en';
  }
  if (browserLang.startsWith('zh')) {
    return 'zh';
  }

  // 3. 默认返回中文
  return 'zh';
}

/**
 * 保存用户语言到 localStorage
 */
export function saveLanguage(lang: Language): void {
  if (typeof window === 'undefined') {
    return; // SSR 环境不执行
  }
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

// 重新导出 useLanguage hook
export { useLanguage } from '@/contexts/LanguageContext';
