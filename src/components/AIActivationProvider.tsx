"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import ActivationModal from "./ActivationModal";
import SuccessModal from "./SuccessModal";

interface ActivationStatus {
  valid: boolean;
  reason?: string;
  activationCode?: string;
  activatedAt?: string;
  expiresAt?: string | null;
  status?: string;
}

interface AIActivationContextType {
  isActivated: boolean;
  checkActivationStatus: () => Promise<void>;
  showActivationModal: () => void;
}

const AIActivationContext = createContext<AIActivationContextType | undefined>(
  undefined
);

export function useAIActivation() {
  const context = useContext(AIActivationContext);
  if (!context) {
    throw new Error(
      "useAIActivation must be used within AIActivationProvider"
    );
  }
  return context;
}

interface AIActivationProviderProps {
  children: ReactNode;
}

export default function AIActivationProvider({
  children,
}: AIActivationProviderProps) {
  const { data: session } = useSession();
  const [isActivated, setIsActivated] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successExpiresAt, setSuccessExpiresAt] = useState<string | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef<boolean>(false);
  const lastActivatedStateRef = useRef<boolean>(false); // 保存上次的激活状态

  // 从localStorage读取初始激活状态（作为fallback）
  const getInitialActivationState = useCallback(() => {
    if (typeof window === "undefined") return false;
    // 检查是否有USER_TOKEN或激活标记
    const hasToken = localStorage.getItem("USER_TOKEN");
    const hasActivation = localStorage.getItem("drive-quiz-activated") === "true";
    return !!(hasToken || hasActivation);
  }, []);

  // 检查激活状态
  const checkActivationStatus = useCallback(async () => {
    if (isCheckingRef.current) return;
    
    // 如果没有session，检查localStorage作为fallback
    if (!session?.user?.email) {
      const localActivated = getInitialActivationState();
      setIsActivated(localActivated);
      lastActivatedStateRef.current = localActivated;
      return;
    }

    isCheckingRef.current = true;
    
    // 在检查前先获取当前状态（从ref或localStorage）
    const previousState = lastActivatedStateRef.current || getInitialActivationState();
    
    try {
      const response = await fetch("/api/activation/status", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        // 网络错误时，保持之前的状态或使用localStorage状态
        const localActivated = getInitialActivationState();
        const finalState = localActivated || previousState;
        setIsActivated(finalState);
        lastActivatedStateRef.current = finalState;
        console.warn("[AIActivationProvider] API request failed, using cached state");
        return;
      }

      const result = await response.json();
      if (result.ok && result.data) {
        const status: ActivationStatus = result.data;
        const isValid = status.valid === true;
        setIsActivated(isValid);
        lastActivatedStateRef.current = isValid;
        
        // 如果激活有效，保存到localStorage
        if (isValid) {
          localStorage.setItem("drive-quiz-activated", "true");
          if (session?.user?.email) {
            localStorage.setItem("drive-quiz-email", session.user.email);
          }
        } else {
          // 如果API明确返回无效，清除localStorage
          localStorage.removeItem("drive-quiz-activated");
          localStorage.removeItem("drive-quiz-email");
        }
        
        if (status.valid && status.expiresAt) {
          setSuccessExpiresAt(status.expiresAt);
        }
      } else {
        // API返回错误，但不清除状态，使用localStorage作为fallback
        const localActivated = getInitialActivationState();
        const finalState = localActivated || previousState;
        setIsActivated(finalState);
        lastActivatedStateRef.current = finalState;
        console.warn("[AIActivationProvider] API returned error, using cached state");
      }
    } catch (error) {
      console.error("[AIActivationProvider] Check activation status error:", error);
      // 网络错误时，保持之前的状态或使用localStorage状态
      const localActivated = getInitialActivationState();
      const finalState = localActivated || previousState;
      setIsActivated(finalState);
      lastActivatedStateRef.current = finalState;
    } finally {
      isCheckingRef.current = false;
    }
  }, [session, getInitialActivationState]);

  // 激活码提交处理
  const handleActivationSubmit = async (email: string, activationCode: string) => {
    try {
      const response = await fetch("/api/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          activationCode,
          userAgent: navigator.userAgent,
        }),
      });

      const result = await response.json();
      if (result.ok) {
        // 保存激活状态到localStorage
        localStorage.setItem("drive-quiz-activated", "true");
        localStorage.setItem("drive-quiz-email", email);
        
        // 保存USER_TOKEN
        if (result.data?.userToken) {
          localStorage.setItem("USER_TOKEN", result.data.userToken);
          // 同时设置cookie
          const expires = new Date();
          expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000);
          document.cookie = `USER_TOKEN=${encodeURIComponent(result.data.userToken)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
        }
        
        setShowModal(false);
        setShowSuccessModal(true);
        setIsActivated(true); // 立即设置为激活状态
        lastActivatedStateRef.current = true; // 更新ref状态
        if (result.data?.expiresAt) {
          setSuccessExpiresAt(result.data.expiresAt);
        }
        // 重新检查激活状态（验证服务器状态）
        await checkActivationStatus();
      } else {
        alert(result.message || "激活失败");
      }
    } catch (error) {
      console.error("[AIActivationProvider] Activation error:", error);
      alert("激活失败，请稍后重试");
    }
  };

  // 显示激活弹窗
  const showActivationModal = useCallback(() => {
    setShowModal(true);
  }, []);

  // 初始化时检查激活状态
  useEffect(() => {
    // 首先从localStorage读取初始状态
    const localActivated = getInitialActivationState();
    setIsActivated(localActivated);
    lastActivatedStateRef.current = localActivated;
    
    if (session?.user?.email) {
      // 如果有session，异步检查服务器状态
      checkActivationStatus();
    } else if (!localActivated) {
      // 如果没有session且localStorage也没有激活状态，设置为false
      setIsActivated(false);
      lastActivatedStateRef.current = false;
    }
  }, [session, checkActivationStatus, getInitialActivationState]);

  // 设置定期检查（每30分钟）
  useEffect(() => {
    if (!session?.user?.email) {
      return;
    }

    // 立即检查一次
    checkActivationStatus();

    // 设置定期检查
    checkIntervalRef.current = setInterval(() => {
      checkActivationStatus();
    }, 30 * 60 * 1000); // 30分钟

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [session, checkActivationStatus]);

  const contextValue: AIActivationContextType = {
    isActivated,
    checkActivationStatus,
    showActivationModal,
  };

  return (
    <AIActivationContext.Provider value={contextValue}>
      {children}
      {showModal && (
        <ActivationModal
          onSubmit={handleActivationSubmit}
          onClose={() => setShowModal(false)}
        />
      )}
      {showSuccessModal && (
        <SuccessModal
          expiresAt={successExpiresAt}
          onClose={() => setShowSuccessModal(false)}
        />
      )}
    </AIActivationContext.Provider>
  );
}

