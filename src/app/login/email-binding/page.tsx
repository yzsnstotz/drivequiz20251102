"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function EmailBindingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const provider = (searchParams?.get("provider") ?? "line");
  const token = (searchParams?.get("token") ?? "");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      try {
        console.log("[EmailBinding] page loaded", { tokenPrefix: token ? String(token).slice(0, 12) : null, provider });
      } catch {}
    }
    if (!token) {
      setError("缺少绑定令牌，请从第三方登录入口重新进入。");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/bind-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, provider }),
      });
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.message || "邮箱绑定失败");
      }
      window.location.href = `/api/auth/signin/${provider}?callbackUrl=/`;
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">完善邮箱以完成 {provider.toUpperCase()} 登录</h1>
        <p className="text-gray-600 mb-6">由于第三方未提供邮箱，我们需要您的邮箱来创建或绑定账号。</p>
        {error && <ErrorBox message={error} />}
        {process.env.NODE_ENV === "development" && token && (
          <div className="mb-4 p-2 rounded-lg bg-gray-50 text-gray-500 text-xs">
            调试: token 前缀 {String(token).slice(0, 16)}...
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </div>
          {token ? (
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300"
            >
              {submitting ? "提交中…" : "提交并继续登录"}
            </button>
          ) : (
            <ErrorBox message="绑定链接缺少令牌或已失效，请重新从 LINE 登录。" />
          )}
        </form>
        <button
          onClick={() => router.push("/login")}
          className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300"
        >
          返回登录页面
        </button>
      </div>
    </div>
  );
}

export default function EmailBindingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-gray-600">加载中…</div>
        </div>
      }
    >
      <EmailBindingPageContent />
    </Suspense>
  );
}
  const ErrorBox = ({ message }: { message: string }) => (
    <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{message}</div>
  );
