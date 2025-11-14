/**
 * 获取 question-processor 服务的 URL
 * 
 * ⚠️ 已废弃：批量处理已改为内部调用，不再需要外部服务
 * 此文件仅用于单个题目处理的 API（translate, polish），这些 API 未来也会重构为内部调用
 * 
 * @deprecated 请使用内部调用替代
 */
export function getProcessorUrl(): string {
  // 临时方案：如果配置了 QUESTION_PROCESSOR_URL，使用它
  // 否则抛出错误，提示需要配置或使用内部调用
  const url = process.env.QUESTION_PROCESSOR_URL;
  
  if (!url) {
    throw new Error(
      'QUESTION_PROCESSOR_URL is not configured. ' +
      'Single question processing APIs (translate, polish) still require external question-processor service. ' +
      'Please configure QUESTION_PROCESSOR_URL or wait for these APIs to be refactored to use internal calls.'
    );
  }
  
  return url.replace(/\/+$/, "");
}

