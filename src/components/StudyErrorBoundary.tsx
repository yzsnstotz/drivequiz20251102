"use client";

import React, { Component, ReactNode } from "react";

interface StudyErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface StudyErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Study 专用 Error Boundary
 * 用于捕获学习/考试页面中的错误，提供友好的错误提示
 */
export class StudyErrorBoundary extends Component<
  StudyErrorBoundaryProps,
  StudyErrorBoundaryState
> {
  constructor(props: StudyErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): StudyErrorBoundaryState {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 记录错误日志
    console.error("[StudyErrorBoundary] 捕获到错误", error, errorInfo);
    
    // 可以根据需要上报到现有的错误上报通道（若已有 util）
    // 例如：reportErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认 fallback UI
      return (
        <div className="container mx-auto px-4 py-6">
          <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-sm dark:shadow-ios-dark-sm">
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-red-600 dark:text-red-400 mb-4">
                <svg
                  className="h-12 w-12 mx-auto"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-ios-dark-text mb-2">
                题目加载过程中出现错误
              </h2>
              <p className="text-sm text-gray-600 dark:text-ios-dark-text-secondary text-center mb-4">
                请稍后重试或联系客服。
              </p>
              <button
                onClick={() => {
                  // 重置错误状态，尝试重新渲染
                  this.setState({
                    hasError: false,
                    error: null,
                  });
                }}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                重试
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default StudyErrorBoundary;

