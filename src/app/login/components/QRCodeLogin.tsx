"use client";

import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/lib/i18n";
import QRCode from "qrcode";

interface QRCodeLoginProps {
  provider: string;
}

export default function QRCodeLogin({ provider }: QRCodeLoginProps) {
  const { t } = useLanguage();
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number>(15 * 60); // 15分钟倒计时（秒）

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 生成二维码登录token
    const generateQRCode = async () => {
      try {
        setLoading(true);
        setError(null);

        // 调用API生成二维码登录token
        const response = await fetch(`/api/auth/qrcode/${provider}`, {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error("Failed to generate QR code");
        }

        const data = await response.json();
        
        // 检查响应是否成功
        if (!data.ok) {
          throw new Error(data.message || "Failed to generate QR code");
        }

        const { token, qrUrl } = data;

        // 检查必要的字段
        if (!token) {
          throw new Error("Token is missing from response");
        }

        // 判断 qrUrl 是否是图片 URL（以图片扩展名结尾或 data URL）
        const isImageUrl = qrUrl && (
          qrUrl.startsWith('data:image') ||
          qrUrl.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i) ||
          qrUrl.startsWith('https://') && qrUrl.includes('qrcode')
        );

        if (isImageUrl) {
          // 如果平台提供直接二维码图片URL，直接使用
          setQrCodeUrl(qrUrl);
          setLoading(false);
        } else if (qrUrl) {
          // 如果是授权URL（如LINE），将其转换为二维码图片
          try {
            const qrDataUrl = await QRCode.toDataURL(qrUrl);
            setQrCodeUrl(qrDataUrl);
            setLoading(false);
          } catch (qrError) {
            console.error("QR code generation error:", qrError);
            throw new Error("Failed to generate QR code image");
          }
        } else {
          // 否则生成包含token的二维码
          try {
            const qrDataUrl = await QRCode.toDataURL(
              `${window.location.origin}/api/auth/qrcode/verify?token=${token}&provider=${provider}`
            );
            setQrCodeUrl(qrDataUrl);
            setLoading(false);
          } catch (qrError) {
            console.error("QR code generation error:", qrError);
            throw new Error("Failed to generate QR code image");
          }
        }

        // 开始轮询检查登录状态
        startPolling(token);
      } catch (err: any) {
        console.error("QR code generation error:", err);
        const errorMessage = err?.message || t("auth.login.error");
        setError(errorMessage);
        setLoading(false);
      }
    };

    generateQRCode();

    // 清理函数：组件卸载时清理定时器
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [provider, t]);

  const startPolling = (token: string) => {
    // 重置倒计时为15分钟
    setTimeRemaining(15 * 60);
    
    // 开始倒计时
    countdownIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setPolling(false);
          setError("二维码已过期，请刷新页面重新生成");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // 开始轮询检查登录状态（减少日志输出，增加轮询间隔）
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/auth/qrcode/${provider}/status?token=${token}`
        );

        if (!response.ok) {
          // 只在开发环境输出警告
          if (process.env.NODE_ENV === "development") {
            console.warn("[QRCodeLogin] Status check failed:", response.status);
          }
          return;
        }

        const data = await response.json();

        if (data.status === "success") {
          setPolling(false);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          // 登录成功，重定向
          window.location.href = "/";
        } else if (data.status === "expired") {
          setPolling(false);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          setError("二维码已过期，请刷新页面重新生成");
        }
        // 如果 status 是 "pending"，继续轮询（不输出日志以减少噪音）
      } catch (err) {
        // 只在开发环境输出错误
        if (process.env.NODE_ENV === "development") {
          console.error("[QRCodeLogin] Polling error:", err);
        }
      }
    }, 5000); // 改为每5秒轮询一次，减少请求频率

    // 15分钟后停止轮询
    setTimeout(() => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setPolling(false);
      setTimeRemaining(0);
      setError("二维码已过期，请刷新页面重新生成");
    }, 15 * 60 * 1000);
  };

  if (loading && !qrCodeUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-600">{t("common.loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          刷新
        </button>
      </div>
    );
  }

  // 格式化剩余时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <p className="text-gray-600 text-center">
        使用{provider === "wechat" ? "微信" : "LINE"}扫描二维码登录
      </p>
      {qrCodeUrl && (
        <div className="bg-white p-4 rounded-lg">
          <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
        </div>
      )}
      {polling && (
        <div className="flex flex-col items-center space-y-2">
          <p className="text-sm text-gray-500">等待扫描...</p>
          {timeRemaining > 0 && (
            <p className={`text-xs ${
              timeRemaining <= 60 ? "text-red-500" : "text-gray-400"
            }`}>
              剩余时间: {formatTime(timeRemaining)}
              {timeRemaining <= 60 && " (即将过期)"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

