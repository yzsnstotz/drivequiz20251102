"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from "react";
import { useAppSession } from "@/contexts/SessionContext";
import { useActivation } from "@/contexts/ActivationContext";
import { usePathname, useRouter } from "next/navigation";
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
  const { data: session, status: sessionStatus } = useAppSession();
  const { status: activationStatus, loading: activationLoading, refresh } = useActivation();
  const pathname = usePathname();
  const router = useRouter();
  const [isActivated, setIsActivated] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successExpiresAt, setSuccessExpiresAt] = useState<string | null>(null);
  // ✅ 修复：移除 checkIntervalRef，不再需要定时器
  const lastActivatedStateRef = useRef<boolean>(false); // 保存上次的激活状态

  // 检测互动页面（在这些页面禁用定期检查，避免中断用户操作）
  const isInteractivePage = useCallback((path: string | null): boolean => {
    if (!path) return false;
    const interactivePages = ['/nearby', '/study', '/exam', '/mistakes', '/royalbattle', '/cars'];
    return interactivePages.some(page => path.startsWith(page));
  }, []);

  // 从localStorage读取初始激活状态（作为fallback）
  const getInitialActivationState = useCallback(() => {
    if (typeof window === "undefined") return false;
    // 检查是否有USER_TOKEN或激活标记
    const hasToken = localStorage.getItem("USER_TOKEN");
    const hasActivation = localStorage.getItem("drive-quiz-activated") === "true";
    return !!(hasToken || hasActivation);
  }, []);

  // ✅ 修复：检查激活状态（使用 ActivationContext 的状态，不再直接请求 API）
  const checkActivationStatus = useCallback(async () => {
    if (sessionStatus !== "authenticated") {
      setIsActivated(false);
      lastActivatedStateRef.current = false;
      return;
    }

    // 首先检查localStorage中的激活状态
    const localActivated = getInitialActivationState();
    
    // 如果没有session，使用localStorage状态
    if (!session?.user?.email) {
      setIsActivated(localActivated);
      lastActivatedStateRef.current = localActivated;
      return;
    }

    // ✅ 修复：使用 ActivationContext 的状态，不再直接请求 API
    if (activationStatus) {
      const isValid = activationStatus.valid === true;
      const reasonCode = activationStatus.reasonCode;
      const isTemporaryError = reasonCode === "DATABASE_ERROR" || reasonCode === "NOT_LOGGED_IN";
      
      if (isValid) {
        // 激活有效，更新状态
        setIsActivated(true);
        lastActivatedStateRef.current = true;
        localStorage.setItem("drive-quiz-activated", "true");
        localStorage.setItem("drive-quiz-email", session.user.email);
        if (activationStatus.expiresAt) {
          setSuccessExpiresAt(activationStatus.expiresAt);
        }
      } else if (isTemporaryError) {
        // 临时错误，保持localStorage状态
        const finalState = localActivated || lastActivatedStateRef.current;
        setIsActivated(finalState);
        lastActivatedStateRef.current = finalState;
      } else {
        // 真正的无效状态，清除localStorage
        setIsActivated(false);
        lastActivatedStateRef.current = false;
        localStorage.removeItem("drive-quiz-activated");
        localStorage.removeItem("drive-quiz-email");
      }
    } else {
      // activationStatus 为 null，使用localStorage状态
      const finalState = localActivated || lastActivatedStateRef.current;
      setIsActivated(finalState);
      lastActivatedStateRef.current = finalState;
    }
  }, [session?.user?.email, sessionStatus, activationStatus, getInitialActivationState]);

  // 显示激活页面（统一使用路由跳转）
  const showActivationModal = useCallback(() => {
    router.push("/activation");
  }, [router]);

  // ✅ 修复：初始化时检查激活状态（使用 ActivationContext 的状态）
  // ✅ 修复：禁止依赖 session 加载状态，只依赖 activationStatus
  useEffect(() => {
    // 未登录或加载中：完全跳过激活逻辑
    if (sessionStatus !== "authenticated") {
      setIsActivated(false);
      lastActivatedStateRef.current = false;
      return;
    }

    // 已登录：继续现有激活判断
    const localActivated = getInitialActivationState();
    setIsActivated(localActivated);
    lastActivatedStateRef.current = localActivated;

    if (!activationLoading && activationStatus) {
      checkActivationStatus();
    } else if (!localActivated) {
      setIsActivated(false);
      lastActivatedStateRef.current = false;
    }
  }, [sessionStatus, activationStatus, activationLoading, checkActivationStatus, getInitialActivationState]);

  const contextValue: AIActivationContextType = {
    isActivated,
    checkActivationStatus,
    showActivationModal,
  };

  return (
    <AIActivationContext.Provider value={contextValue}>
      {children}
      {showSuccessModal && (
        <SuccessModal
          isOpen={showSuccessModal}
          expiresAt={successExpiresAt}
          onClose={() => setShowSuccessModal(false)}
        />
      )}
    </AIActivationContext.Provider>
  );
}

