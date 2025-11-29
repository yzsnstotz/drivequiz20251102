"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
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
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [isActivated, setIsActivated] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successExpiresAt, setSuccessExpiresAt] = useState<string | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef<boolean>(false);
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

  // 检查激活状态
  const checkActivationStatus = useCallback(async () => {
    if (isCheckingRef.current) return;
    
    // 首先检查localStorage中的激活状态
    const localActivated = getInitialActivationState();
    const storedEmail = typeof window !== "undefined" ? localStorage.getItem("drive-quiz-email") : null;
    
    // 如果没有session，使用localStorage状态
    if (!session?.user?.email) {
      setIsActivated(localActivated);
      lastActivatedStateRef.current = localActivated;
      return;
    }

    isCheckingRef.current = true;
    
    // 在检查前先获取当前状态（从ref或localStorage）
    const previousState = lastActivatedStateRef.current || localActivated;
    
    try {
      const response = await fetch("/api/activation/status", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        // 网络错误时，保持之前的状态或使用localStorage状态
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
        
        // 检查reasonCode，区分临时错误和真正的无效状态
        const reasonCode = (result.data as any)?.reasonCode;
        const isTemporaryError = reasonCode === "DATABASE_ERROR" || reasonCode === "NOT_LOGGED_IN";
        
        if (isValid) {
          // 激活有效，更新状态
          setIsActivated(true);
          lastActivatedStateRef.current = true;
          localStorage.setItem("drive-quiz-activated", "true");
          if (session?.user?.email) {
            localStorage.setItem("drive-quiz-email", session.user.email);
          }
          if (status.expiresAt) {
            setSuccessExpiresAt(status.expiresAt);
          }
          console.log("[AIActivationProvider] Activation status validated successfully", {
            email: session?.user?.email,
            reasonCode,
          });
        } else if (isTemporaryError) {
          // 临时错误（数据库错误、未登录等），不清除localStorage，保持当前状态
          const finalState = localActivated || previousState;
          setIsActivated(finalState);
          lastActivatedStateRef.current = finalState;
          console.warn("[AIActivationProvider] Temporary error from API, keeping cached state", {
            reasonCode,
            localActivated,
            previousState,
            email: session?.user?.email,
          });
        } else {
          // 真正的无效状态（过期、状态无效等），清除localStorage
          setIsActivated(false);
          lastActivatedStateRef.current = false;
          localStorage.removeItem("drive-quiz-activated");
          localStorage.removeItem("drive-quiz-email");
          console.warn("[AIActivationProvider] Activation invalid from API, clearing activation state", {
            reasonCode,
            email: session?.user?.email,
          });
        }
      } else {
        // API返回错误，但不清除状态，使用localStorage作为fallback
        const finalState = localActivated || previousState;
        setIsActivated(finalState);
        lastActivatedStateRef.current = finalState;
        console.warn("[AIActivationProvider] API returned error, using cached state", {
          localActivated,
          previousState,
          email: session?.user?.email,
        });
      }
    } catch (error) {
      console.error("[AIActivationProvider] Check activation status error:", error);
      // 网络错误时，保持之前的状态或使用localStorage状态
      const finalState = localActivated || previousState;
      setIsActivated(finalState);
      lastActivatedStateRef.current = finalState;
    } finally {
      isCheckingRef.current = false;
    }
  }, [session, getInitialActivationState]);

  // 显示激活页面（统一使用路由跳转）
  const showActivationModal = useCallback(() => {
    router.push("/activation");
  }, [router]);

  // 初始化时检查激活状态
  useEffect(() => {
    // 首先从localStorage读取初始状态
    const localActivated = getInitialActivationState();
    const storedEmail = typeof window !== "undefined" ? localStorage.getItem("drive-quiz-email") : null;
    
    // 优先使用localStorage状态，确保用户不会看到闪烁
    setIsActivated(localActivated);
    lastActivatedStateRef.current = localActivated;
    
    // 检查email匹配
    if (session?.user?.email && storedEmail) {
      if (session.user.email !== storedEmail) {
        console.warn("[AIActivationProvider] Email mismatch between session and localStorage", {
          sessionEmail: session.user.email,
          storedEmail,
        });
        // email不匹配时，使用localStorage中的email（如果存在）或session的email
        // 这里保持激活状态，让API检查来决定
      }
    }
    
    if (session?.user?.email) {
      // 如果有session，异步检查服务器状态（不阻塞UI）
      // 只有在localStorage有激活状态且API明确返回无效时，才清除状态
      checkActivationStatus().catch((error) => {
        console.error("[AIActivationProvider] Initial activation check failed:", error);
        // 检查失败时保持localStorage状态
      });
    } else if (!localActivated) {
      // 如果没有session且localStorage也没有激活状态，设置为false
      setIsActivated(false);
      lastActivatedStateRef.current = false;
    }
  }, [session, checkActivationStatus, getInitialActivationState]);

  // 设置定期检查（延长到60分钟，并在互动页面禁用）
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

    // 立即检查一次（仅在非互动页面）
    checkActivationStatus();

    // 设置定期检查（延长到60分钟）
    checkIntervalRef.current = setInterval(() => {
      checkActivationStatus();
    }, 60 * 60 * 1000); // 60分钟

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [session, pathname, checkActivationStatus, isInteractivePage]);

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

