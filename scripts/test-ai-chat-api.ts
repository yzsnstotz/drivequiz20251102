#!/usr/bin/env tsx

/**
 * 测试 AI 聊天 API 是否正确写入日志
 */

async function testAiChatApi() {
  console.log('🧪 测试 AI 聊天 API 日志写入');
  console.log('==============================');

  try {
    // 模拟前端调用
    const response = await fetch('http://localhost:3000/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: '你好，请介绍一下日本驾照考试',
        lang: 'zh',
        scene: 'chat',
        userId: null, // 模拟未登录用户
      }),
    });

    const result = await response.json();
    console.log('API 响应:', {
      status: response.status,
      ok: result.ok,
      hasData: !!result.data,
      answerLength: result.data?.answer?.length || 0,
    });

    if (result.ok) {
      console.log('✅ API 调用成功');
    } else {
      console.log('❌ API 调用失败:', result.errorCode, result.message);
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testAiChatApi().catch(console.error);
}

export { testAiChatApi };
