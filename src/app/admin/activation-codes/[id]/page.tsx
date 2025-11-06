// ============================================================
// 文件路径: src/app/admin/activation-codes/[id]/page.tsx
// 功能: 激活码编辑页面（详情展示、编辑提交、删除）
// 依赖: src/lib/apiClient.ts
// 规范: camelCase 字段 + ISO8601 时间 + { ok, data } 响应
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import apiClient from "@/lib/apiClient";

type ActivationStatus = "enabled" | "disabled" | "expired" | "suspended";

type ActivationCodeRow = {
  id: number;
  code: string;
  usageLimit: number | null;
  usedCount: number;
  status: ActivationStatus;
  expiresAt: string | null;
  enabledAt: string | null;
  notes: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; errorCode?: string; message?: string };

function normalizeRow(row: any): ActivationCodeRow {
  if (!row) throw new Error("Empty row");
  if ("usageLimit" in row || "expiresAt" in row) return row as ActivationCodeRow;
  return {
    id: row.id,
    code: row.code,
    usageLimit: row.usage_limit ?? null,
    usedCount: row.used_count ?? 0,
    status: row.status,
    expiresAt: row.expires_at ?? null,
    enabledAt: row.enabled_at ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function isoToDateInput(v: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function dateInputToISO(v: string): string | null {
  if (!v) return null;
  // 统一写入为 UTC 当天 00:00:00
  return new Date(`${v}T00:00:00.000Z`).toISOString();
}

export default function ActivationCodeEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = useMemo(() => Number(params?.id), [params?.id]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [row, setRow] = useState<ActivationCodeRow | null>(null);

  const [usageLimit, setUsageLimit] = useState<number | "" | null>("");
  const [status, setStatus] = useState<ActivationStatus>("enabled");
  const [expiresDate, setExpiresDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    async function fetchDetail() {
      if (!Number.isFinite(id)) {
        setError("无效的 ID");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get(`/api/admin/activation-codes/${id}`);
        if (!res.ok) {
          const errRes = res as ApiErr;
          throw new Error(errRes.message || "加载失败");
        }
        const okRes = res as ApiOk<any>;
        const data = normalizeRow(okRes.data);
        if (!mounted) return;
        setRow(data);
        setUsageLimit(data.usageLimit ?? "");
        setStatus(data.status);
        setExpiresDate(isoToDateInput(data.expiresAt));
        setNotes(data.notes ?? "");
      } catch (e: any) {
        // 若后端暂未实现 GET，则允许“盲改”（提交时再校验）
        setRow(null);
        setError(e?.message || "未能加载详情（可能接口未实现 GET）");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchDetail();
    return () => {
      mounted = false;
    };
  }, [id]);

  const isExpired = row?.status === "expired";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isFinite(id)) {
      setError("无效的 ID");
      return;
    }
    setSaving(true);
    setError(null);

    if (row && row.status === "expired" && status !== "expired") {
      setSaving(false);
      setError("该激活码已过期，状态不可改回其他值。");
      return;
    }

    try {
      const payload: Record<string, any> = {};
      if (usageLimit !== "") payload.usageLimit = Number(usageLimit);
      if (status) payload.status = status;
      if (expiresDate) payload.expiresAt = dateInputToISO(expiresDate);
      if (notes !== (row?.notes ?? "")) payload.notes = notes;

      if (Object.keys(payload).length === 0) {
        setSaving(false);
        setError("请至少修改一个字段后再保存。");
        return;
      }

      const res = await apiClient.put(`/api/admin/activation-codes/${id}`, payload);
      if (!res.ok) {
        const errRes = res as ApiErr;
        throw new Error(errRes.message || "保存失败");
      }
      router.push("/admin/activation-codes");
    } catch (e: any) {
      setError(e?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!Number.isFinite(id)) {
      setError("无效的 ID");
      return;
    }
    if (!confirm("确定删除该激活码？（已使用的激活码不可删除）")) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await apiClient.delete(`/api/admin/activation-codes/${id}`);
      if (!res.ok) {
        const errRes = res as ApiErr;
        throw new Error(errRes.message || "删除失败");
      }
      router.push("/admin/activation-codes");
    } catch (e: any) {
      setError(e?.message || "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">编辑激活码</h1>
        <button
          className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
          onClick={() => router.push("/admin/activation-codes")}
        >
          返回列表
        </button>
      </div>

      {loading && (
        <div className="rounded-md border border-gray-200 bg-white p-4">加载中…</div>
      )}

      {!loading && error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && (
        <form onSubmit={onSubmit} className="space-y-6 rounded-md border border-gray-200 bg-white p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-gray-600">ID</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2 text-gray-700"
                value={Number.isFinite(id) ? String(id) : ""}
                disabled
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">激活码</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2 text-gray-700"
                value={row?.code ?? "(未加载)"} // 若未加载，展示占位
                disabled
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">使用上限（usageLimit）</label>
              <input
                type="number"
                min={0}
                className="w-full rounded-md border px-3 py-2"
                value={usageLimit === "" ? "" : Number(usageLimit)}
                onChange={(e) => {
                  const v = e.target.value;
                  setUsageLimit(v === "" ? "" : Number(v));
                }}
                placeholder={
                  row?.usageLimit !== null && row?.usageLimit !== undefined
                    ? String(row.usageLimit)
                    : ""
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">状态（status）</label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={status}
                onChange={(e) => setStatus(e.target.value as ActivationStatus)}
                disabled={row?.status === "expired"}
              >
                <option value="enabled">enabled</option>
                <option value="disabled">disabled</option>
                <option value="suspended">suspended</option>
                <option value="expired">expired</option>
              </select>
              {row?.status === "expired" && (
                <p className="mt-1 text-xs text-gray-500">该激活码已过期，状态不可改回其他值。</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">到期日期（expiresAt）</label>
              <input
                type="date"
                className="w-full rounded-md border px-3 py-2"
                value={expiresDate}
                onChange={(e) => setExpiresDate(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">保存时将写入为 UTC 00:00:00（ISO8601）。</p>
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">已用次数（只读）</label>
              <input
                type="number"
                className="w-full rounded-md border px-3 py-2"
                value={row?.usedCount ?? 0}
                disabled
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-600">备注（notes）</label>
            <textarea
              className="h-24 w-full rounded-md border px-3 py-2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={row?.notes ?? ""}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-x-2">
              <button
                type="submit"
                className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                disabled={saving}
              >
                {saving ? "保存中..." : "保存修改"}
              </button>
              <button
                type="button"
                className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
                onClick={() => router.refresh()}
                disabled={saving || deleting}
              >
                刷新
              </button>
            </div>

            <button
              type="button"
              className="rounded-md bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              onClick={onDelete}
              disabled={deleting}
              title="已使用的激活码不可删除"
            >
              {deleting ? "删除中..." : "删除激活码"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
