/**
 * 清除所有缓存工具
 * 用于清除应用相关的所有 localStorage 和缓存数据
 */

/**
 * 清除所有应用相关的缓存和 localStorage
 * 包括：
 * - 题目包缓存（所有版本）
 * - 用户数据（昵称、token等）
 * - 学习进度
 * - 错题本、考试历史、练习历史
 * - AI聊天历史
 * - 激活状态
 * - 登录记忆
 * - 主题设置
 * - 语言设置
 * - 其他动态缓存
 */
export function clearAllCache(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // 1. 清除题目包相关缓存
    const packageVersion = localStorage.getItem('dq_questions_package_current_version');
    if (packageVersion) {
      localStorage.removeItem('dq_questions_package_current_version');
      localStorage.removeItem(`dq_questions_package_v_${packageVersion}`);
    }
    
    // 清除所有版本的题目包缓存（遍历所有键）
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('dq_questions_package_v_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // 2. 清除用户数据
    localStorage.removeItem('USER_TOKEN');
    localStorage.removeItem('USER_ID');
    localStorage.removeItem('user_nickname');
    localStorage.removeItem('drive-quiz-activated');
    localStorage.removeItem('drive-quiz-email');
    localStorage.removeItem('activation-status');

    // 3. 清除学习进度（动态键，需要遍历）
    const progressKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('progress_')) {
        progressKeys.push(key);
      }
    }
    progressKeys.forEach(key => localStorage.removeItem(key));

    // 4. 清除学习记录
    localStorage.removeItem('mistakeBook');
    localStorage.removeItem('examHistory');
    localStorage.removeItem('practiceHistory');

    // 5. 清除考试状态（动态键）
    const examKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('exam_')) {
        examKeys.push(key);
      }
    }
    examKeys.forEach(key => localStorage.removeItem(key));

    // 6. 清除AI相关缓存
    localStorage.removeItem('AI_CHAT_HISTORY');
    
    // 清除题目AI对话缓存（动态键）
    const dialogKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('question_ai_dialog_')) {
        dialogKeys.push(key);
      }
    }
    dialogKeys.forEach(key => localStorage.removeItem(key));

    // 7. 清除登录记忆
    localStorage.removeItem('lastLoginProvider');
    localStorage.removeItem('lastLoginEmail');

    // 8. 清除设置
    localStorage.removeItem('darkMode');
    localStorage.removeItem('user-language');

    // 9. 清除其他缓存
    localStorage.removeItem('splash_ad_shown_date');
    
    // 清除后台管理token（如果存在）
    localStorage.removeItem('ADMIN_TOKEN');

    // 10. 清除所有以特定前缀开头的其他缓存（兜底）
    const allKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        // 保留一些系统级别的键（如果有的话）
        // 这里我们清除所有应用相关的键
        allKeys.push(key);
      }
    }
    
    // 注意：这里不清除所有键，只清除我们已知的应用相关键
    // 如果用户有其他应用的localStorage数据，应该保留

    // 11. 清除 Cookie 中的相关数据
    // 清除 USER_TOKEN cookie
    document.cookie = 'USER_TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'USER_ID=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'sb-access-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

    console.log('[clearAllCache] 所有缓存已清除');
  } catch (error) {
    console.error('[clearAllCache] 清除缓存失败:', error);
    throw error;
  }
}

/**
 * 获取缓存使用情况统计
 */
export function getCacheStats(): {
  totalKeys: number;
  appKeys: number;
  estimatedSize: string;
} {
  if (typeof window === 'undefined') {
    return { totalKeys: 0, appKeys: 0, estimatedSize: '0 KB' };
  }

  try {
    let totalSize = 0;
    let appKeys = 0;
    const appKeyPrefixes = [
      'dq_questions_package',
      'USER_',
      'user_',
      'drive-quiz',
      'activation',
      'progress_',
      'mistakeBook',
      'examHistory',
      'practiceHistory',
      'AI_CHAT',
      'question_ai_dialog',
      'lastLogin',
      'darkMode',
      'user-language',
      'splash_ad',
      'ADMIN_TOKEN',
      'exam_',
    ];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || '';
        totalSize += key.length + value.length;
        
        // 检查是否是应用相关的键
        if (appKeyPrefixes.some(prefix => key.startsWith(prefix))) {
          appKeys++;
        }
      }
    }

    const sizeKB = (totalSize / 1024).toFixed(2);
    return {
      totalKeys: localStorage.length,
      appKeys,
      estimatedSize: `${sizeKB} KB`,
    };
  } catch (error) {
    console.error('[getCacheStats] 获取缓存统计失败:', error);
    return { totalKeys: 0, appKeys: 0, estimatedSize: '0 KB' };
  }
}

