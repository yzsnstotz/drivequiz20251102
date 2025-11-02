'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';

export default function AdminLoginPage() {
  const [checking, setChecking] = useState(true);
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // 首次挂载：本地已存在 ADMIN_TOKEN 则直接校验
  useEffect(() => {
    const t = localStorage.getItem('ADMIN_TOKEN');
    if (!t) {
      setChecking(false);
      return;
    }
    setToken(t);
    apiFetch('/api/admin/ping')
      .then(() => router.replace('/admin'))
      .catch(() => {
        // token 失效则退出检查，停留在登录表单
        setChecking(false);
      });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError('请输入管理员口令');
      return;
    }
    localStorage.setItem('ADMIN_TOKEN', token);
    try {
      await apiFetch('/api/admin/ping');
      router.replace('/admin');
    } catch (err: any) {
      setError(err?.message || '登录失败，请检查口令');
      localStorage.removeItem('ADMIN_TOKEN');
    }
  }

  if (checking) {
    return (
      <div className="p-6">
        <p>Checking admin session…</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Admin Login</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-2">管理员口令（ADMIN_TOKEN）</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="输入后台口令"
            autoFocus
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          className="px-4 py-2 bg-black text-white rounded"
        >
          登录
        </button>
      </form>
    </div>
  );
}
