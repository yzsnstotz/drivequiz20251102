"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSession } from "@/contexts/SessionContext";

export default function BindEmailPage() {
  const { session, status } = useAppSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      if (!session?.needsEmailBinding) {
        router.replace("/");
      }
    } else if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/bind-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "绑定失败，请稍后重试");
      }
      router.replace("/");
    } catch (err: any) {
      setError(err?.message || "发生未知错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border p-6">
      <h1 className="mb-4 text-xl font-semibold">绑定邮箱</h1>
      <p className="mb-4 text-sm text-gray-600">
        当前登录方式未提供邮箱，请输入你常用的邮箱地址，用于统一账号。
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="your@email.com"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "绑定中..." : "确认绑定"}
        </button>
      </form>
    </div>
  );
}

