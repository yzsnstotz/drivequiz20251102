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
      .catch((err: any) => {
        // token 失效则退出检查，停留在登录表单
        if (err?.errorCode === 'AUTH_REQUIRED' || err?.errorCode === 'UNAUTHORIZED' || err?.status === 401 || err?.status === 403) {
          setError('Token 无效或已过期，请重新输入');
        }
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
      if (err?.errorCode === 'AUTH_REQUIRED' || err?.errorCode === 'UNAUTHORIZED' || err?.status === 401 || err?.status === 403) {
        setError('Token 无效或未配置，请检查口令');
      } else if (err?.errorCode === 'MISSING_ADMIN_TOKEN' || err?.errorCode === 'MISSING_TOKEN') {
        setError('未配置管理员口令');
      } else {
        setError(err?.message || '登录失败，请检查口令');
      }
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8 space-y-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-center mb-2">Admin Login</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">管理员口令（ADMIN_TOKEN）</label>
              <input
                type="password"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none transition-colors touch-manipulation"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="输入后台口令"
                autoFocus
              />
            </div>
            {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-xl">{error}</p>}
            <button
              type="submit"
              className="w-full px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 active:bg-blue-700 active:scale-[0.98] touch-manipulation transition-all shadow-sm font-medium text-base"
            >
              登录
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
