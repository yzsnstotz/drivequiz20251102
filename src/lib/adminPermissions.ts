// 管理员权限类别定义

// 权限类别常量
export const PERMISSION_CATEGORIES = {
  ACTIVATION_CODES: 'activation_codes',     // 激活码管理
  USERS: 'users',                           // 用户管理
  QUESTIONS: 'questions',                   // 题目管理
  ADMINS: 'admins',                         // 管理员管理（只有超级管理员）
  OPERATION_LOGS: 'operation_logs',        // 操作日志
  STATS: 'stats',                           // 统计
  TASKS: 'tasks',                            // 任务管理
  MERCHANTS: 'merchants',                   // 商户管理
  VIDEOS: 'videos',                          // 视频管理
  CONTACT_AND_TERMS: 'contact_and_terms',   // 联系与条款
  // AI板块细分权限
  AI_MONITOR: 'ai_monitor',                 // AI每日摘要看板
  AI_LOGS: 'ai_logs',                       // AI问答日志
  AI_FILTERS: 'ai_filters',                 // AI过滤规则
  AI_CONFIG: 'ai_config',                   // AI配置中心
  AI_RAG: 'ai_rag',                         // AI知识库上传
  AI_RAG_LIST: 'ai_rag_list',              // AI文档列表
} as const;

export type PermissionCategory = typeof PERMISSION_CATEGORIES[keyof typeof PERMISSION_CATEGORIES];

// 权限类别显示名称
export const PERMISSION_LABELS: Record<PermissionCategory, string> = {
  [PERMISSION_CATEGORIES.ACTIVATION_CODES]: '激活码管理',
  [PERMISSION_CATEGORIES.USERS]: '用户管理',
  [PERMISSION_CATEGORIES.QUESTIONS]: '题目管理',
  [PERMISSION_CATEGORIES.ADMINS]: '管理员管理',
  [PERMISSION_CATEGORIES.OPERATION_LOGS]: '操作日志',
  [PERMISSION_CATEGORIES.STATS]: '统计',
  [PERMISSION_CATEGORIES.TASKS]: '任务管理',
  [PERMISSION_CATEGORIES.MERCHANTS]: '商户管理',
  [PERMISSION_CATEGORIES.VIDEOS]: '视频管理',
  [PERMISSION_CATEGORIES.CONTACT_AND_TERMS]: '联系与条款',
  [PERMISSION_CATEGORIES.AI_MONITOR]: 'AI每日摘要看板',
  [PERMISSION_CATEGORIES.AI_LOGS]: 'AI问答日志',
  [PERMISSION_CATEGORIES.AI_FILTERS]: 'AI过滤规则',
  [PERMISSION_CATEGORIES.AI_CONFIG]: 'AI配置中心',
  [PERMISSION_CATEGORIES.AI_RAG]: 'AI知识库上传',
  [PERMISSION_CATEGORIES.AI_RAG_LIST]: 'AI文档列表',
};

// 页面路径到权限类别的映射
export const PATH_TO_PERMISSION: Record<string, PermissionCategory> = {
  '/admin/activation-codes': PERMISSION_CATEGORIES.ACTIVATION_CODES,
  '/admin/users': PERMISSION_CATEGORIES.USERS,
  '/admin/questions': PERMISSION_CATEGORIES.QUESTIONS,
  '/admin/admins': PERMISSION_CATEGORIES.ADMINS,
  '/admin/operation-logs': PERMISSION_CATEGORIES.OPERATION_LOGS,
  '/admin/stats': PERMISSION_CATEGORIES.STATS,
  '/admin/tasks': PERMISSION_CATEGORIES.TASKS,
  '/admin/merchants': PERMISSION_CATEGORIES.MERCHANTS,
  '/admin/videos': PERMISSION_CATEGORIES.VIDEOS,
  '/admin/contact-and-terms': PERMISSION_CATEGORIES.CONTACT_AND_TERMS,
  // AI板块细分权限映射
  '/admin/ai/monitor': PERMISSION_CATEGORIES.AI_MONITOR,
  '/admin/ai/logs': PERMISSION_CATEGORIES.AI_LOGS,
  '/admin/ai/filters': PERMISSION_CATEGORIES.AI_FILTERS,
  '/admin/ai/config': PERMISSION_CATEGORIES.AI_CONFIG,
  '/admin/ai/scenes': PERMISSION_CATEGORIES.AI_CONFIG,
  '/admin/ai/rag': PERMISSION_CATEGORIES.AI_RAG,
  '/admin/ai/rag/list': PERMISSION_CATEGORIES.AI_RAG_LIST,
  // AI总览页面（如果存在）默认使用monitor权限
  '/admin/ai': PERMISSION_CATEGORIES.AI_MONITOR,
};

/**
 * 检查管理员是否有指定权限
 * @param adminPermissions 管理员的权限数组
 * @param requiredPermission 需要的权限
 * @param isDefaultAdmin 是否为超级管理员
 */
export function hasPermission(
  adminPermissions: string[] | null | undefined,
  requiredPermission: PermissionCategory,
  isDefaultAdmin: boolean = false
): boolean {
  // 超级管理员拥有所有权限
  if (isDefaultAdmin) {
    return true;
  }

  // 如果没有权限数组，返回false
  if (!adminPermissions || !Array.isArray(adminPermissions)) {
    return false;
  }

  // 检查是否包含所需权限
  return adminPermissions.includes(requiredPermission);
}

/**
 * 根据路径检查权限
 */
export function hasPermissionForPath(
  adminPermissions: string[] | null | undefined,
  pathname: string,
  isDefaultAdmin: boolean = false
): boolean {
  // 超级管理员拥有所有权限
  if (isDefaultAdmin) {
    return true;
  }

  // 登录页面不需要权限检查
  if (pathname === '/admin/login') {
    return true;
  }

  // 特殊处理：AI总览页面需要至少有一个AI权限
  if (pathname === '/admin/ai') {
    if (!adminPermissions || !Array.isArray(adminPermissions)) {
      return false;
    }
    // 检查是否有任意AI权限
    const aiPermissions = [
      PERMISSION_CATEGORIES.AI_MONITOR,
      PERMISSION_CATEGORIES.AI_LOGS,
      PERMISSION_CATEGORIES.AI_FILTERS,
      PERMISSION_CATEGORIES.AI_CONFIG,
      PERMISSION_CATEGORIES.AI_RAG,
      PERMISSION_CATEGORIES.AI_RAG_LIST,
    ];
    return aiPermissions.some(perm => adminPermissions.includes(perm));
  }

  // 查找路径对应的权限
  for (const [path, permission] of Object.entries(PATH_TO_PERMISSION)) {
    if (pathname === path || pathname.startsWith(path + '/')) {
      return hasPermission(adminPermissions, permission, isDefaultAdmin);
    }
  }

  // 如果路径没有对应的权限映射，默认需要权限
  return false;
}

