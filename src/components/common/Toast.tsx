"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastProps {
  type: ToastType;
  message: string;
  duration?: number;
  onClose?: () => void;
}

/**
 * Toast 通知组件
 * 支持 success/error/info/warning 四种类型
 */
export default function Toast({ type, message, duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300); // 等待动画完成
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const iconMap = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle,
  };

  const colorClasses = {
    success: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
  };

  const Icon = iconMap[type];

  if (!isVisible) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center space-x-3 px-4 py-3 rounded-lg shadow-lg border transition-all duration-300 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      } ${colorClasses[type]}`}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <p className="text-sm font-medium flex-1">{message}</p>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onClose?.(), 300);
        }}
        className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="关闭"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Toast 管理器 Hook
 */
export function useToast() {
  const [toasts, setToasts] = useState<Array<ToastProps & { id: string }>>([]);

  const showToast = (type: ToastType, message: string, duration?: number) => {
    const id = Math.random().toString(36).substring(7);
    const toast: ToastProps & { id: string } = {
      id,
      type,
      message,
      duration,
      onClose: () => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      },
    };

    setToasts((prev) => [...prev, toast]);
  };

  const ToastContainer = () => (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  );

  return {
    showToast,
    ToastContainer,
  };
}

