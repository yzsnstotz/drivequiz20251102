/**
 * 用户行为记录工具
 * 用于记录用户在应用中的各种行为到 user_behaviors 表
 */

export type BehaviorType = 
  | 'start_quiz' 
  | 'complete_quiz' 
  | 'pause_quiz' 
  | 'resume_quiz' 
  | 'view_page' 
  | 'other';

export type ClientType = 'web' | 'mobile' | 'api' | 'desktop' | 'other';

interface LogBehaviorOptions {
  behaviorType: BehaviorType;
  metadata?: Record<string, any>;
  userAgent?: string;
  clientType?: ClientType;
}

/**
 * 记录用户行为
 * @param options 行为选项
 */
export async function logUserBehavior(options: LogBehaviorOptions): Promise<void> {
  try {
    // 只在浏览器环境中执行
    if (typeof window === 'undefined') {
      return;
    }

    // 获取用户 token
    const token = localStorage.getItem('USER_TOKEN');
    if (!token) {
      // 如果没有 token，不记录（匿名用户）
      return;
    }

    // 获取 user agent（如果没有提供）
    const userAgent = options.userAgent || navigator.userAgent;

    // 调用 API 记录行为
    const response = await fetch('/api/user-behaviors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        behaviorType: options.behaviorType,
        metadata: options.metadata || {},
        userAgent,
        clientType: options.clientType,
      }),
    });

    if (!response.ok) {
      console.warn('[logUserBehavior] Failed to log behavior:', {
        behaviorType: options.behaviorType,
        status: response.status,
      });
    }
  } catch (error) {
    // 静默失败，不影响用户体验
    console.warn('[logUserBehavior] Error logging behavior:', error);
  }
}

/**
 * 记录用户开始做题
 */
export async function logStartQuiz(quizId?: string, quizType?: string): Promise<void> {
  await logUserBehavior({
    behaviorType: 'start_quiz',
    metadata: {
      quizId,
      quizType,
    },
  });
}

/**
 * 记录用户完成做题
 */
export async function logCompleteQuiz(quizId?: string, quizType?: string, score?: number): Promise<void> {
  await logUserBehavior({
    behaviorType: 'complete_quiz',
    metadata: {
      quizId,
      quizType,
      score,
    },
  });
}

/**
 * 记录用户暂停做题
 */
export async function logPauseQuiz(quizId?: string): Promise<void> {
  await logUserBehavior({
    behaviorType: 'pause_quiz',
    metadata: {
      quizId,
    },
  });
}

/**
 * 记录用户恢复做题
 */
export async function logResumeQuiz(quizId?: string): Promise<void> {
  await logUserBehavior({
    behaviorType: 'resume_quiz',
    metadata: {
      quizId,
    },
  });
}

/**
 * 记录用户查看页面
 */
export async function logViewPage(pageName: string, metadata?: Record<string, any>): Promise<void> {
  await logUserBehavior({
    behaviorType: 'view_page',
    metadata: {
      pageName,
      ...metadata,
    },
  });
}

