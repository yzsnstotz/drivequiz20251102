"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSession } from "@/contexts/SessionContext";

export default function BindEmailPage() {
  const { session, status } = useAppSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
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
      if (!agree) {
        throw new Error("请先勾选同意收集邮箱目的说明");
      }
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
      <div className="space-y-2 mb-4">
        <p className="text-sm text-gray-800">This app may request your email address for account verification and multi-provider login linking. Your email will only be used to help unify your accounts across Google, LINE and other login providers. By continuing, you agree to the collection and use of your email according to our privacy policy.</p>
        <p className="text-sm text-gray-800">本アプリは、アカウント認証および複数のログイン方法（Google・LINE 等）の統合のため、メールアドレスの提供をお願いする場合があります。提供されたメールアドレスはアカウント統合以外の目的には使用いたしません。続行することで、当社のプライバシーポリシーに基づくメールアドレスの取得に同意したものとみなされます。</p>
        <p className="text-sm text-gray-800">本应用可能会请求你的邮箱地址，用于账号验证以及多个登录方式（Google、LINE 等）的统一绑定。你的邮箱仅用于统一账号，不会用于其他目的。继续操作表示你同意我们按照隐私政策收集和使用你的邮箱。</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="your@email.com"
        />
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            required
            checked={agree}
            onChange={() => setAgree(!agree)}
          />
          <span className="text-sm text-gray-600">
            I understand and agree to the purpose of collecting my email address.
          </span>
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading || !agree}
          className="w-full rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "绑定中..." : "确认绑定"}
        </button>
      </form>
    </div>
  );
}
