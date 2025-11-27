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

  // 检查激活状态
  const checkActivationStatus = useCallback(async () => {
    if (isCheckingRef.current) return;
    if (!session?.user?.email) {
      setIsActivated(false);
      return;
    }

    isCheckingRef.current = true;
    try {
      const response = await fetch("/api/activation/status", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        setIsActivated(false);
        return;
      }

      const result = await response.json();
      if (result.ok && result.data) {
        const status: ActivationStatus = result.data;
        setIsActivated(status.valid === true);
        
        if (status.valid && status.expiresAt) {
          setSuccessExpiresAt(status.expiresAt);
        }
      } else {
        setIsActivated(false);
      }
    } catch (error) {
      console.error("[AIActivationProvider] Check activation status error:", error);
      setIsActivated(false);
    } finally {
      isCheckingRef.current = false;
    }
  }, [session]);

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
        setShowModal(false);
        setShowSuccessModal(true);
        if (result.data?.expiresAt) {
          setSuccessExpiresAt(result.data.expiresAt);
        }
        // 重新检查激活状态
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
    if (session?.user?.email) {
      checkActivationStatus();
    } else {
      setIsActivated(false);
    }
  }, [session, checkActivationStatus]);

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

