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
  const { data: session } = useAppSession();
  const { status: activationStatus, loading: activationLoading, refreshActivationStatus } = useActivation();
  const pathname = usePathname();
  const router = useRouter();
  const [isActivated, setIsActivated] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successExpiresAt, setSuccessExpiresAt] = useState<string | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
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
  }, [session?.user?.email, activationStatus, getInitialActivationState]);

  // 显示激活页面（统一使用路由跳转）
  const showActivationModal = useCallback(() => {
    router.push("/activation");
  }, [router]);

  // ✅ 修复：初始化时检查激活状态（使用 ActivationContext 的状态）
  useEffect(() => {
    // 首先从localStorage读取初始状态
    const localActivated = getInitialActivationState();
    
    // 优先使用localStorage状态，确保用户不会看到闪烁
    setIsActivated(localActivated);
    lastActivatedStateRef.current = localActivated;
    
    // ✅ 修复：使用 ActivationContext 的状态，不再直接请求 API
    if (session?.user?.email && !activationLoading) {
      checkActivationStatus();
    } else if (!localActivated) {
      // 如果没有session且localStorage也没有激活状态，设置为false
      setIsActivated(false);
      lastActivatedStateRef.current = false;
    }
  }, [session?.user?.email, activationStatus, activationLoading, checkActivationStatus]);

  // ✅ 修复：设置定期检查（使用 ActivationContext 的 refreshActivationStatus，延长到60分钟，并在互动页面禁用）
  useEffect(() => {
    if (!session?.user?.email) {
      return;
    }

    // 如果是互动页面，禁用定期检查
    if (isInteractivePage(pathname)) {
      // 清除可能存在的定期检查
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    // ✅ 修复：立即检查一次（仅在非互动页面），使用 ActivationContext 的状态
    checkActivationStatus();

    // ✅ 修复：设置定期检查（延长到60分钟），通过 ActivationContext 的 refreshActivationStatus 刷新
    checkIntervalRef.current = setInterval(() => {
      // 调用 ActivationContext 的 refreshActivationStatus，它会使用 requestCache 去重
      refreshActivationStatus().then(() => {
        // 刷新后更新本地状态
        checkActivationStatus();
      });
    }, 60 * 60 * 1000); // 60分钟

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [session?.user?.email, pathname, checkActivationStatus, isInteractivePage, refreshActivationStatus]);

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

