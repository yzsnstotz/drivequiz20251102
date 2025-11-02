'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import ActivationModal from './ActivationModal';

// 激活成功后保存到 localStorage 的 key
const ACTIVATION_KEY = 'drive-quiz-activated';
const ACTIVATION_EMAIL_KEY = 'drive-quiz-email'; // 保存用户邮箱用于验证

interface ActivationProviderProps {
  children: ReactNode;
}

export default function ActivationProvider({ children }: ActivationProviderProps) {
  const [isActivated, setIsActivated] = useState(true); // 默认为 true，避免页面闪烁
  const [showModal, setShowModal] = useState(false);
  const pathname = usePathname();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 检查激活状态是否有效
  const checkActivationStatus = useCallback(async () => {
    try {
      const email = localStorage.getItem(ACTIVATION_EMAIL_KEY);
      const activated = localStorage.getItem(ACTIVATION_KEY);

      // 如果没有邮箱但有激活状态，说明是旧用户，清除激活状态
      if (!email && activated === 'true') {
        console.warn('[ActivationProvider] Found activation without email, clearing activation state');
        localStorage.removeItem(ACTIVATION_KEY);
        setIsActivated(false);
        setShowModal(true);
        return;
      }

      // 如果没有邮箱也没有激活状态，显示激活模态框
      if (!email) {
        setIsActivated(false);
        setShowModal(true);
        return;
      }

      // 调用API检查激活状态
      const response = await fetch(`/api/activation/check?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (result.ok && result.data?.valid === true) {
        // 激活状态有效
        localStorage.setItem(ACTIVATION_KEY, 'true');
        setIsActivated(true);
        setShowModal(false);
      } else {
        // 激活状态无效（已过期或其他原因）
        localStorage.removeItem(ACTIVATION_KEY);
        localStorage.removeItem(ACTIVATION_EMAIL_KEY);
        setIsActivated(false);
        setShowModal(true);
      }
    } catch (error) {
      console.error('[ActivationProvider] Failed to check activation status:', error);
      // 出错时不清除激活状态，避免误判
    }
  }, []);

  useEffect(() => {
    // 排除 admin 路由：admin 页面不需要产品激活检查
    if (pathname?.startsWith('/admin')) {
      setIsActivated(true);
      setShowModal(false);
      // 清除检查定时器
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    // 立即检查激活状态
    checkActivationStatus();

    // 定期检查激活状态（每5分钟检查一次）
    checkIntervalRef.current = setInterval(() => {
      checkActivationStatus();
    }, 5 * 60 * 1000); // 5分钟

    // 清理函数
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [pathname, checkActivationStatus]);

  const handleActivationSubmit = async (email: string, activationCode: string) => {
    try {
      const userAgent = navigator.userAgent;

      const response = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, activationCode, userAgent }),
      });

      const result = await response.json();

      // API 返回格式: { ok: true, data: {...} } 或 { ok: false, errorCode, message }
      if (response.ok && result.ok === true) {
        // 保存激活状态和邮箱
        localStorage.setItem(ACTIVATION_KEY, 'true');
        localStorage.setItem(ACTIVATION_EMAIL_KEY, email);
        setIsActivated(true);
        setShowModal(false);
        // 立即检查一次激活状态
        checkActivationStatus();
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
