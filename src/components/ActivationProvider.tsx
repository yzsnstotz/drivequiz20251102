'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import ActivationModal from './ActivationModal';
import SuccessModal from './SuccessModal';

// 激活成功后保存到 localStorage 的 key
const ACTIVATION_KEY = 'drive-quiz-activated';
const ACTIVATION_EMAIL_KEY = 'drive-quiz-email'; // 保存用户邮箱用于验证

interface ActivationProviderProps {
  children: ReactNode;
}

export default function ActivationProvider({ children }: ActivationProviderProps) {
  const [isActivated, setIsActivated] = useState(true); // 默认为 true，避免页面闪烁
  const [showModal, setShowModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successExpiresAt, setSuccessExpiresAt] = useState<string | null>(null);
  const pathname = usePathname();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckTimeRef = useRef<number>(0); // 记录上次检查时间
  const MIN_CHECK_INTERVAL = 5 * 60 * 1000; // 最小检查间隔：5分钟

  // 检查激活状态是否有效
  // 定期检查逻辑说明：
  // 1. 每30分钟自动检查一次激活状态
  // 2. 最小检查间隔：5分钟（避免频繁检查）
  // 3. 只有在API明确返回 valid: false 且原因是明确的（过期、上限、状态不可用）时才会清除激活状态
  // 4. 如果API错误、网络问题或返回非明确无效，保持当前激活状态
  // 5. 这样可以确保：定期检查不会因为临时网络问题而误清除激活状态
  const checkActivationStatus = useCallback(async () => {
    // 检查最小间隔，避免频繁检查
    const now = Date.now();
    if (now - lastCheckTimeRef.current < MIN_CHECK_INTERVAL) {
      console.log('[ActivationProvider] Skipping check due to minimum interval, keeping activation state');
      return;
    }
    lastCheckTimeRef.current = now;
    
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
      // 注意：如果请求失败或超时，不会清除激活状态
      // 创建超时控制器，避免长时间等待
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
      
      const response = await fetch(`/api/activation/check?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      // 如果HTTP响应状态不是成功状态（200-299），视为API错误，保持当前激活状态
      if (!response.ok) {
        console.warn('[ActivationProvider] HTTP response not OK, keeping current activation state', {
          status: response.status,
          statusText: response.statusText
        });
        const currentActivated = localStorage.getItem(ACTIVATION_KEY);
        const currentEmail = localStorage.getItem(ACTIVATION_EMAIL_KEY);
        if (currentActivated === 'true' && currentEmail) {
          setIsActivated(true);
          setShowModal(false);
        }
        return;
      }

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        // JSON解析失败，视为API错误，保持当前激活状态
        console.warn('[ActivationProvider] Failed to parse API response, keeping current activation state');
        const currentActivated = localStorage.getItem(ACTIVATION_KEY);
        const currentEmail = localStorage.getItem(ACTIVATION_EMAIL_KEY);
        if (currentActivated === 'true' && currentEmail) {
          setIsActivated(true);
          setShowModal(false);
        }
        return;
      }

      if (result.ok && result.data?.valid === true) {
        // 激活状态有效，更新本地状态
        localStorage.setItem(ACTIVATION_KEY, 'true');
        setIsActivated(true);
        setShowModal(false);
        console.log('[ActivationProvider] Activation status validated successfully');
      } else {
        // API返回结果处理
        if (result.ok && result.data?.valid === false) {
          // API明确返回激活无效
          // 但为了更安全，我们需要额外验证：检查是否有本地激活状态
          // 如果有本地激活状态，可能是API临时问题，暂时保持激活状态
          const currentActivated = localStorage.getItem(ACTIVATION_KEY);
          const currentEmail = localStorage.getItem(ACTIVATION_EMAIL_KEY);
          
          // 检查无效的原因
          const reason = result.data?.reason || '';
          const isDefinitiveInvalid = reason.includes('已过期') || 
                                      reason.includes('使用上限') || 
                                      reason.includes('状态不可用');
          
          // 只有在确认是明确的无效原因（如过期、上限、状态不可用）时才清除
          // 如果是其他原因（如未找到记录等），可能是数据同步问题，保持激活状态
          if (isDefinitiveInvalid && currentActivated === 'true' && currentEmail === email) {
            // 确认无效，清除激活状态
            console.warn('[ActivationProvider] Activation definitively invalid from API, clearing activation state', {
              reason,
              email
            });
            localStorage.removeItem(ACTIVATION_KEY);
            localStorage.removeItem(ACTIVATION_EMAIL_KEY);
            setIsActivated(false);
            setShowModal(true);
          } else {
            // 非明确的无效原因，或可能是数据同步问题，保持激活状态
            console.warn('[ActivationProvider] Activation invalid but reason unclear, keeping activation state for safety', {
              reason,
              currentActivated,
              currentEmail,
              email,
              isDefinitiveInvalid
            });
            // 保持激活状态，不显示模态框
            if (currentActivated === 'true' && currentEmail) {
              setIsActivated(true);
              setShowModal(false);
            }
          }
        } else {
          // API 错误或网络问题，保持现有激活状态（重要：不清除）
          console.warn('[ActivationProvider] API check failed or returned unclear status, keeping current activation state', {
            ok: result.ok,
            valid: result.data?.valid,
            message: result.message
          });
          // 不执行任何清除操作，保持当前状态
        }
      }
    } catch (error: any) {
      // 网络错误、超时或其他异常，保持现有激活状态
      console.error('[ActivationProvider] Failed to check activation status:', error);
      // 重要：出错时不清除激活状态，避免误判导致用户被强制激活
      // 如果有本地激活状态，继续信任本地状态
      const currentActivated = localStorage.getItem(ACTIVATION_KEY);
      const currentEmail = localStorage.getItem(ACTIVATION_EMAIL_KEY);
      if (currentActivated === 'true' && currentEmail) {
        // 保持激活状态，不显示模态框
        setIsActivated(true);
        setShowModal(false);
        console.log('[ActivationProvider] Keeping activation state due to check error');
      }
    }
  }, []);

  // 初始化时检查激活状态，但只在首次加载时检查，之后信任本地状态
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

    // 首次加载时检查：如果有本地激活状态，立即信任
    const email = localStorage.getItem(ACTIVATION_EMAIL_KEY);
    const activated = localStorage.getItem(ACTIVATION_KEY);
    
    if (activated === 'true' && email) {
      // 有本地激活状态和邮箱，立即信任，不进行API检查（避免频繁检查）
      setIsActivated(true);
      setShowModal(false);
      
      // 不立即进行API检查，避免在用户使用过程中被清除
      // 只在后台延迟检查（不影响用户体验）
      // 延迟10秒后再检查，避免影响页面加载和用户操作
      setTimeout(() => {
        // 检查最小间隔，避免频繁检查
        const now = Date.now();
        if (now - lastCheckTimeRef.current >= MIN_CHECK_INTERVAL) {
          checkActivationStatus().catch(() => {
            // 静默失败，保持激活状态
          });
        }
      }, 10000); // 10秒后检查
      
      // 定期检查（每30分钟检查一次，减少频率）
      if (!checkIntervalRef.current) {
        checkIntervalRef.current = setInterval(() => {
          // 检查最小间隔
          const now = Date.now();
          if (now - lastCheckTimeRef.current >= MIN_CHECK_INTERVAL) {
            checkActivationStatus().catch(() => {
              // 静默失败，保持激活状态
            });
          }
        }, 30 * 60 * 1000); // 30分钟
      }
    } else if (!email) {
      // 没有邮箱，需要激活
      setIsActivated(false);
      setShowModal(true);
    } else {
      // 有邮箱但没有激活状态，检查一次
      checkActivationStatus().catch(() => {
        // 失败时保持未激活状态
      });
    }

    // 清理函数
    return () => {
      // 不清除定时器，让它在整个应用生命周期运行
    };
  }, []); // 只在组件挂载时执行一次

  // 当路径变化时，只更新UI状态，不重新检查激活
  useEffect(() => {
    if (pathname?.startsWith('/admin')) {
      setIsActivated(true);
      setShowModal(false);
      return;
    }

    // 非admin路由：如果有本地激活状态，保持激活
    const activated = localStorage.getItem(ACTIVATION_KEY);
    const email = localStorage.getItem(ACTIVATION_EMAIL_KEY);
    
    if (activated === 'true' && email) {
      setIsActivated(true);
      setShowModal(false);
    } else if (!email) {
      setIsActivated(false);
      setShowModal(true);
    }
  }, [pathname]);

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
        
        // 保存有效期信息用于显示
        const expiresAt = result.data?.expiresAt || null;
        setSuccessExpiresAt(expiresAt);
        
        // 显示成功提示
        setIsActivated(true);
        setShowModal(false);
        setShowSuccessModal(true);
        
        // 不再立即检查激活状态，避免跳回激活页面
        // 注意：成功提示关闭后，用户已处于激活状态，不需要再次检查
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
        <SuccessModal
          isOpen={showSuccessModal}
          expiresAt={successExpiresAt}
          onClose={() => setShowSuccessModal(false)}
        />
      </div>
    );
  }

  return (
    <>
      <SuccessModal
        isOpen={showSuccessModal}
        expiresAt={successExpiresAt}
        onClose={() => setShowSuccessModal(false)}
      />
      {children}
    </>
  );
}
