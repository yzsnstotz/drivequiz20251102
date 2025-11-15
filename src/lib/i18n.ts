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
    'nav.questions': '题目列表',
    'nav.questionProcessing': '批量题目处理',
    'nav.polishReviews': '润色确认',
    'nav.admins': '管理员',
    'nav.operationLogs': '操作日志',
    'nav.stats': '统计',
    'nav.tasks': '任务',
    'nav.merchants': '商户管理',
    'nav.merchantCategories': '商户类型',
    'nav.adSlots': '广告栏管理',
    'nav.videos': '视频管理',
    'nav.contactAndTerms': '联系与条款',
    'nav.aiMonitor': '每日摘要看板',
    'nav.aiLogs': '问答日志',
    'nav.aiFilters': '过滤规则',
    'nav.aiConfig': '配置中心',
    'nav.aiScenes': '场景配置',
    'nav.aiRag': '知识库上传',
    'nav.aiRagList': '文档列表',
    
    // 菜单分组
    'nav.group.users': '用户管理',
    'nav.group.questions': '题库管理',
    'nav.group.merchant': '商户与广告',
    'nav.group.ai': 'AI管理',
    'nav.group.system': '系统管理',
    
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
    'nav.questions': 'Question List',
    'nav.questionProcessing': 'Batch Question Processing',
    'nav.polishReviews': 'Polish Reviews',
    'nav.admins': 'Admins',
    'nav.operationLogs': 'Operation Logs',
    'nav.stats': 'Stats',
    'nav.tasks': 'Tasks',
    'nav.merchants': 'Merchants',
    'nav.merchantCategories': 'Merchant Categories',
    'nav.adSlots': 'Ad Slots',
    'nav.videos': 'Videos',
    'nav.contactAndTerms': 'Contact & Terms',
    'nav.aiMonitor': 'Daily Summary',
    'nav.aiLogs': 'AI Logs',
    'nav.aiFilters': 'Filters',
    'nav.aiConfig': 'Config Center',
    'nav.aiScenes': 'Scene Config',
    'nav.aiRag': 'RAG Upload',
    'nav.aiRagList': 'Document List',
    
    // 菜单分组
    'nav.group.users': 'User Management',
    'nav.group.questions': 'Question Management',
    'nav.group.merchant': 'Merchants & Ads',
    'nav.group.ai': 'AI Management',
    'nav.group.system': 'System Management',
    
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
    'nav.questions': '問題一覧',
    'nav.questionProcessing': '問題一括処理',
    'nav.polishReviews': '推敲確認',
    'nav.admins': '管理者',
    'nav.operationLogs': '操作ログ',
    'nav.stats': '統計',
    'nav.tasks': 'タスク',
    'nav.merchants': '店舗管理',
    'nav.merchantCategories': '店舗タイプ',
    'nav.adSlots': '広告欄管理',
    'nav.videos': '動画管理',
    'nav.contactAndTerms': '連絡と規約',
    'nav.aiMonitor': '日次サマリー',
    'nav.aiLogs': 'AIログ',
    'nav.aiFilters': 'フィルター',
    'nav.aiConfig': '設定センター',
    'nav.aiScenes': 'シーン設定',
    'nav.aiRag': 'RAGアップロード',
    'nav.aiRagList': 'ドキュメント一覧',
    
    // 菜单分组
    'nav.group.users': 'ユーザー管理',
    'nav.group.questions': '問題管理',
    'nav.group.merchant': '店舗と広告',
    'nav.group.ai': 'AI管理',
    'nav.group.system': 'システム管理',
    
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

// 用户端翻译
export const userTranslations: Translations = {
  zh: {
    // 导航
    'nav.home': '首页',
    'nav.study': '驾照',
    'nav.services': '服务',
    'nav.profile': '我的',
    
    // 首页
    'home.welcome': '欢迎使用 ZALEM',
    'home.study': '课程学习',
    'home.exam': '模拟考试',
    'home.mistakes': '错题本',
    'home.royalbattle': '大乱斗',
    'home.aiAssistant': 'AI 智能助手',
    'home.aiDescription': '随时解答你的驾考问题',
    'home.changeLanguage': '切换语言',
    'home.subtitle': '开启你的学车之旅',
    
    // 题目
    'question.previous': '上一题',
    'question.next': '下一题',
    'question.correct': '正确',
    'question.incorrect': '错误',
    'question.correctAnswer': '答对了！',
    'question.wrongAnswer': '答错了...',
    'question.loading': '加载中...',
    'question.loadError': '加载题目失败',
    'question.image': '题目图片',
    'question.current': '当前题目：',
    
    // 通用
    'common.loading': '加载中...',
    'common.error': '错误',
    'common.back': '返回',
    'common.close': '关闭',
    'common.confirm': '确认',
    'common.cancel': '取消',
    'common.save': '保存',
    'common.submit': '提交',
    
    // 语言
    'language.title': '选择语言',
    'language.chinese': '中文',
    'language.english': 'English',
    'language.japanese': '日本語',
    'language.save': '保存',
    
    // 学习页面
    'study.title': '学习',
    'study.subtitle': '选择你想要学习的内容',
    'study.category.lecture': '学科讲习',
    'study.category.provisional': '仮免',
    'study.category.license': '免许',
    'study.loadError': '加载题目集失败',
    
    // 考试页面
    'exam.title': '模拟考试',
    'exam.subtitle': '选择一套模拟考试开始练习',
    'exam.loading': '加载考试中...',
    'exam.questions': '题目',
    'exam.minutes': '分钟',
    'exam.timeLimit': '限时',
    'exam.progress': '进度',
    'exam.accuracy': '正确率',
    'exam.type.single': '单选题',
    'exam.type.multiple': '多选题',
    'exam.type.truefalse': '判断题',
    'exam.aiAssistant': 'AI助手',
    'exam.openAI': '打开AI助手',
    'exam.image': '题目图片',
    'exam.true': '正确',
    'exam.false': '错误',
    
    // 错题本
    'mistakes.title': '错题本',
    'mistakes.detail': '错题详情',
    'mistakes.empty': '暂无错题',
    'mistakes.emptyDesc': '在学习或模拟考试中答错的题目会自动保存到错题本',
    'mistakes.clearAll': '清空全部',
    'mistakes.remove': '移出错题本',
    'mistakes.explanation': '解析',
    'mistakes.correctAnswer': '(正确答案)',
    'mistakes.type.single': '单选题',
    'mistakes.type.multiple': '多选题',
    'mistakes.type.truefalse': '判断题',
    'mistakes.type.question': '题目',
    'mistakes.aiAssistant': 'AI助手',
    'mistakes.openAI': '打开AI助手',
    'mistakes.image': '题目图片',
    'mistakes.true': '正确',
    'mistakes.false': '错误',
    
    // 大乱斗
    'royalbattle.title': '大乱斗',
    'royalbattle.gameOver': '游戏结束',
    'royalbattle.finalScore': '最终得分',
    'royalbattle.correctCount': '答对题目数',
    'royalbattle.backHome': '返回首页',
    'royalbattle.loading': '加载题目中...',
    'royalbattle.aiAssistant': 'AI助手',
    'royalbattle.openAI': '打开AI助手',
    'royalbattle.image': '题目图片',
    'royalbattle.true': '正确',
    'royalbattle.false': '错误',
    
    // 我的页面
    'profile.title': '我的',
    'profile.mistakes': '错题本',
    'profile.mistakesDesc': '复习错误的题目',
    'profile.examHistory': '考试历史',
    'profile.examHistoryDesc': '查看考试成绩记录',
    'profile.practiceHistory': '做题历史',
    'profile.practiceHistoryDesc': '查看最近50题记录',
    'profile.clearActivation': '清除激活',
    'profile.clearActivationDesc': '清除当前激活状态，需要重新激活',
    'profile.settings': '设置',
    'profile.settingsDesc': '偏好设置',
    'profile.noExamHistory': '暂无考试记录',
    'profile.noPracticeHistory': '暂无做题记录',
    'profile.practiceHistoryTitle': '做题历史（最近50题）',
    'profile.questionBankVersion': '题库版本',
    'profile.questionBankVersionUnknown': '未缓存/未知',
    'profile.correct': '正确',
    'profile.incorrect': '错误',
    'profile.fromExam': '考试',
    'profile.fromStudy': '学习',
    'profile.clearActivationConfirm': '确定要清除激活状态吗？清除后需要重新激活才能使用应用。',
    'profile.clearActivationSuccess': '激活状态已清除，页面将刷新',
    
    // 食宿页面
    'nearby.title': '附近的店铺',
    'nearby.subtitle': '发现周边美食与便利',
    'nearby.loading': '加载中...',
    'nearby.noMerchants': '暂无商户',
    
    // 汽车页面
    'cars.title': '汽车服务',
    'cars.subtitle': '驾校用车、租车等服务',
    'cars.category.all': '全部',
    'cars.category.school': '驾校用车',
    'cars.category.rental': '租车',
    'cars.category.used': '二手车',
    'cars.category.maintenance': '汽车保养',
    'cars.category.training': '驾驶培训',
    'cars.sortByDistance': '按距离',
    'cars.sortByRating': '按评分',
  },
  en: {
    // 导航
    'nav.home': 'Home',
    'nav.study': 'License',
    'nav.services': 'Services',
    'nav.profile': 'Profile',
    
    // 首页
    'home.welcome': 'Welcome to ZALEM',
    'home.study': 'Study',
    'home.exam': 'Exam',
    'home.mistakes': 'Mistakes',
    'home.royalbattle': 'Battle',
    'home.aiAssistant': 'AI Assistant',
    'home.aiDescription': 'Answer your driving test questions anytime',
    'home.changeLanguage': 'Change Language',
    'home.subtitle': 'Start your driving journey',
    
    // 题目
    'question.previous': 'Previous',
    'question.next': 'Next',
    'question.correct': 'Correct',
    'question.incorrect': 'Incorrect',
    'question.correctAnswer': 'Correct!',
    'question.wrongAnswer': 'Wrong...',
    'question.loading': 'Loading...',
    'question.loadError': 'Failed to load questions',
    'question.image': 'Question Image',
    'question.current': 'Current Question:',
    
    // 通用
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.back': 'Back',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.submit': 'Submit',
    
    // 语言
    'language.title': 'Select Language',
    'language.chinese': 'Chinese',
    'language.english': 'English',
    'language.japanese': 'Japanese',
    'language.save': 'Save',
    
    // 学习页面
    'study.title': 'Study',
    'study.subtitle': 'Choose what you want to learn',
    'study.category.lecture': 'Lecture',
    'study.category.provisional': 'Provisional',
    'study.category.license': 'License',
    'study.loadError': 'Failed to load question sets',
    
    // 考试页面
    'exam.title': 'Mock Exam',
    'exam.subtitle': 'Choose a mock exam to start practicing',
    'exam.loading': 'Loading exam...',
    'exam.questions': 'Questions',
    'exam.minutes': 'minutes',
    'exam.timeLimit': 'Time Limit',
    'exam.progress': 'Progress',
    'exam.accuracy': 'Accuracy',
    'exam.type.single': 'Single Choice',
    'exam.type.multiple': 'Multiple Choice',
    'exam.type.truefalse': 'True/False',
    'exam.aiAssistant': 'AI Assistant',
    'exam.openAI': 'Open AI Assistant',
    'exam.image': 'Question Image',
    'exam.true': 'True',
    'exam.false': 'False',
    
    // 错题本
    'mistakes.title': 'Mistakes',
    'mistakes.detail': 'Mistake Details',
    'mistakes.empty': 'No Mistakes',
    'mistakes.emptyDesc': 'Questions answered incorrectly in study or mock exams will be automatically saved to the mistake book',
    'mistakes.clearAll': 'Clear All',
    'mistakes.remove': 'Remove from Mistakes',
    'mistakes.explanation': 'Explanation',
    'mistakes.correctAnswer': '(Correct Answer)',
    'mistakes.type.single': 'Single Choice',
    'mistakes.type.multiple': 'Multiple Choice',
    'mistakes.type.truefalse': 'True/False',
    'mistakes.type.question': 'Question',
    'mistakes.aiAssistant': 'AI Assistant',
    'mistakes.openAI': 'Open AI Assistant',
    'mistakes.image': 'Question Image',
    'mistakes.true': 'True',
    'mistakes.false': 'False',
    
    // 大乱斗
    'royalbattle.title': 'Battle',
    'royalbattle.gameOver': 'Game Over',
    'royalbattle.finalScore': 'Final Score',
    'royalbattle.correctCount': 'Correct Answers',
    'royalbattle.backHome': 'Back to Home',
    'royalbattle.loading': 'Loading questions...',
    'royalbattle.aiAssistant': 'AI Assistant',
    'royalbattle.openAI': 'Open AI Assistant',
    'royalbattle.image': 'Question Image',
    'royalbattle.true': 'True',
    'royalbattle.false': 'False',
    
    // 我的页面
    'profile.title': 'Profile',
    'profile.mistakes': 'Mistakes',
    'profile.mistakesDesc': 'Review incorrect questions',
    'profile.examHistory': 'Exam History',
    'profile.examHistoryDesc': 'View exam score records',
    'profile.practiceHistory': 'Practice History',
    'profile.practiceHistoryDesc': 'View last 50 questions',
    'profile.clearActivation': 'Clear Activation',
    'profile.clearActivationDesc': 'Clear current activation status, requires reactivation',
    'profile.settings': 'Settings',
    'profile.settingsDesc': 'Preferences',
    'profile.noExamHistory': 'No exam records',
    'profile.noPracticeHistory': 'No practice records',
    'profile.practiceHistoryTitle': 'Practice History (Last 50 Questions)',
    'profile.questionBankVersion': 'Question Bank Version',
    'profile.questionBankVersionUnknown': 'Not cached/Unknown',
    'profile.correct': 'Correct',
    'profile.incorrect': 'Incorrect',
    'profile.fromExam': 'Exam',
    'profile.fromStudy': 'Study',
    'profile.clearActivationConfirm': 'Are you sure you want to clear the activation status? You will need to reactivate to use the app.',
    'profile.clearActivationSuccess': 'Activation status cleared, page will refresh',
    
    // 食宿页面
    'nearby.title': 'Nearby Shops',
    'nearby.subtitle': 'Discover nearby food and convenience',
    'nearby.loading': 'Loading...',
    'nearby.noMerchants': 'No merchants',
    
    // 汽车页面
    'cars.title': 'Car Services',
    'cars.subtitle': 'Driving school cars, rentals and more',
    'cars.category.all': 'All',
    'cars.category.school': 'School Cars',
    'cars.category.rental': 'Rental',
    'cars.category.used': 'Used Cars',
    'cars.category.maintenance': 'Maintenance',
    'cars.category.training': 'Training',
    'cars.sortByDistance': 'By Distance',
    'cars.sortByRating': 'By Rating',
  },
  ja: {
    // 导航
    'nav.home': 'ホーム',
    'nav.study': '免許',
    'nav.services': 'サービス',
    'nav.profile': 'マイページ',
    
    // 首页
    'home.welcome': 'ZALEMへようこそ',
    'home.study': '学習',
    'home.exam': '試験',
    'home.mistakes': '間違い',
    'home.royalbattle': 'バトル',
    'home.aiAssistant': 'AIアシスタント',
    'home.aiDescription': '運転免許試験の質問にいつでも答えます',
    'home.changeLanguage': '言語を変更',
    'home.subtitle': 'あなたの運転学習の旅を始めましょう',
    
    // 题目
    'question.previous': '前へ',
    'question.next': '次へ',
    'question.correct': '正しい',
    'question.incorrect': '間違い',
    'question.correctAnswer': '正解です！',
    'question.wrongAnswer': '不正解です...',
    'question.loading': '読み込み中...',
    'question.loadError': '問題の読み込みに失敗しました',
    'question.image': '問題画像',
    'question.current': '現在の問題：',
    
    // 通用
    'common.loading': '読み込み中...',
    'common.error': 'エラー',
    'common.back': '戻る',
    'common.close': '閉じる',
    'common.confirm': '確認',
    'common.cancel': 'キャンセル',
    'common.save': '保存',
    'common.submit': '送信',
    
    // 语言
    'language.title': '言語を選択',
    'language.chinese': '中国語',
    'language.english': '英語',
    'language.japanese': '日本語',
    'language.save': '保存',
    
    // 学习页面
    'study.title': '学習',
    'study.subtitle': '学習したい内容を選択',
    'study.category.lecture': '学科講習',
    'study.category.provisional': '仮免',
    'study.category.license': '免許',
    'study.loadError': '問題セットの読み込みに失敗しました',
    
    // 考试页面
    'exam.title': '模擬試験',
    'exam.subtitle': '模擬試験を選択して練習を開始',
    'exam.loading': '試験を読み込み中...',
    'exam.questions': '問題',
    'exam.minutes': '分',
    'exam.timeLimit': '制限時間',
    'exam.progress': '進捗',
    'exam.accuracy': '正答率',
    'exam.type.single': '単一選択',
    'exam.type.multiple': '複数選択',
    'exam.type.truefalse': '正誤問題',
    'exam.aiAssistant': 'AIアシスタント',
    'exam.openAI': 'AIアシスタントを開く',
    'exam.image': '問題画像',
    'exam.true': '正しい',
    'exam.false': '間違い',
    
    // 错题本
    'mistakes.title': '間違い',
    'mistakes.detail': '間違いの詳細',
    'mistakes.empty': '間違いなし',
    'mistakes.emptyDesc': '学習や模擬試験で間違えた問題は自動的に間違い帳に保存されます',
    'mistakes.clearAll': 'すべてクリア',
    'mistakes.remove': '間違い帳から削除',
    'mistakes.explanation': '解説',
    'mistakes.correctAnswer': '(正解)',
    'mistakes.type.single': '単一選択',
    'mistakes.type.multiple': '複数選択',
    'mistakes.type.truefalse': '正誤問題',
    'mistakes.type.question': '問題',
    'mistakes.aiAssistant': 'AIアシスタント',
    'mistakes.openAI': 'AIアシスタントを開く',
    'mistakes.image': '問題画像',
    'mistakes.true': '正しい',
    'mistakes.false': '間違い',
    
    // 大乱斗
    'royalbattle.title': 'バトル',
    'royalbattle.gameOver': 'ゲーム終了',
    'royalbattle.finalScore': '最終スコア',
    'royalbattle.correctCount': '正解数',
    'royalbattle.backHome': 'ホームに戻る',
    'royalbattle.loading': '問題を読み込み中...',
    'royalbattle.aiAssistant': 'AIアシスタント',
    'royalbattle.openAI': 'AIアシスタントを開く',
    'royalbattle.image': '問題画像',
    'royalbattle.true': '正しい',
    'royalbattle.false': '間違い',
    
    // 我的页面
    'profile.title': 'マイページ',
    'profile.mistakes': '間違い',
    'profile.mistakesDesc': '間違えた問題を復習',
    'profile.examHistory': '試験履歴',
    'profile.examHistoryDesc': '試験スコア記録を表示',
    'profile.practiceHistory': '練習履歴',
    'profile.practiceHistoryDesc': '最近50問を表示',
    'profile.clearActivation': '有効化をクリア',
    'profile.clearActivationDesc': '現在の有効化状態をクリアし、再有効化が必要',
    'profile.settings': '設定',
    'profile.settingsDesc': '設定',
    'profile.noExamHistory': '試験記録なし',
    'profile.noPracticeHistory': '練習記録なし',
    'profile.practiceHistoryTitle': '練習履歴（最近50問）',
    'profile.questionBankVersion': '問題集バージョン',
    'profile.questionBankVersionUnknown': 'キャッシュなし/不明',
    'profile.correct': '正解',
    'profile.incorrect': '不正解',
    'profile.fromExam': '試験',
    'profile.fromStudy': '学習',
    'profile.clearActivationConfirm': '有効化状態をクリアしてもよろしいですか？アプリを使用するには再有効化が必要です。',
    'profile.clearActivationSuccess': '有効化状態がクリアされました。ページを更新します',
    
    // 食宿页面
    'nearby.title': '近くの店舗',
    'nearby.subtitle': '近くの飲食店と便利な店を発見',
    'nearby.loading': '読み込み中...',
    'nearby.noMerchants': '店舗なし',
    
    // 汽车页面
    'cars.title': '自動車サービス',
    'cars.subtitle': '教習車、レンタカーなどのサービス',
    'cars.category.all': 'すべて',
    'cars.category.school': '教習車',
    'cars.category.rental': 'レンタル',
    'cars.category.used': '中古車',
    'cars.category.maintenance': 'メンテナンス',
    'cars.category.training': '運転訓練',
    'cars.sortByDistance': '距離順',
    'cars.sortByRating': '評価順',
  },
};

export function getTranslation(key: string, lang: Language): string {
  // 优先查找用户端翻译
  const userTrans = userTranslations[lang];
  if (userTrans && userTrans[key]) {
    return userTrans[key];
  }
  // 回退到管理后台翻译
  const adminTrans = adminTranslations[lang];
  if (adminTrans && adminTrans[key]) {
    return adminTrans[key];
  }
  // 最后回退到中文
  return userTranslations.zh[key] || adminTranslations.zh[key] || key;
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
