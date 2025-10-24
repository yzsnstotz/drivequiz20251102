'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import ActivationModal from './ActivationModal';

// 激活成功后保存到 localStorage 的 key
const ACTIVATION_KEY = 'drive-quiz-activated';

interface ActivationProviderProps {
  children: ReactNode;
}

export default function ActivationProvider({ children }: ActivationProviderProps) {
  const [isActivated, setIsActivated] = useState(true); // 默认为 true，避免页面闪烁
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // 在客户端检查 localStorage
    const activated = localStorage.getItem(ACTIVATION_KEY);
    if (!activated) {
      setIsActivated(false);
      setShowModal(true);
    }
  }, []);

  const handleActivationSubmit = async (email: string, activationCode: string) => {
    try {
      const userAgent = navigator.userAgent;

      const response = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, activationCode, userAgent }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        localStorage.setItem(ACTIVATION_KEY, 'true');
        setIsActivated(true);
        setShowModal(false);
      } else {
        throw new Error(result.message || '激活失败');
      }
    } catch (error: any) {
      // 重新抛出错误，让 ActivationModal 组件可以捕获并显示
      throw new Error(error.message || '网络错误，请稍后重试');
    }
  };

  if (!isActivated) {
    return (
      <div className="min-h-screen bg-gray-50">
        {showModal && (
          <ActivationModal
            onSubmit={handleActivationSubmit}
            onClose={() => {}} // 不允许关闭
          />
        )}
      </div>
    );
  }

  return <>{children}</>;
}
