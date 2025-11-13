/**
 * 获取 question-processor 服务的 URL
 * 
 * 在生产环境中，必须配置 QUESTION_PROCESSOR_URL 环境变量
 * 在开发环境中，可以使用本地地址 http://127.0.0.1:8083
 */
export function getProcessorUrl(): string {
  const url = process.env.QUESTION_PROCESSOR_URL || `http://127.0.0.1:${process.env.QUESTION_PROCESSOR_PORT || 8083}`;
  
  // 在生产环境中，如果 URL 是本地地址，给出明确错误
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    if (!process.env.QUESTION_PROCESSOR_URL || url.includes('127.0.0.1') || url.includes('localhost')) {
      throw new Error(
        'QUESTION_PROCESSOR_URL environment variable is not configured. ' +
        'Please set QUESTION_PROCESSOR_URL in Vercel environment variables to the production question-processor service URL. ' +
        'Example: https://question-processor.example.com or https://question-processor.zalem.app'
      );
    }
  }
  
  return url.replace(/\/+$/, "");
}


