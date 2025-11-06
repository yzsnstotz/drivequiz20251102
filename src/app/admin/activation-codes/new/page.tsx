"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, apiPost } from "@/lib/apiClient";

type GenStatus = "enabled" | "disabled" | "suspended"; // 生成阶段不允许直接置为 expired
type GeneratedItem = {
  id: number;
  code: string;
  status: "enabled" | "disabled" | "suspended" | "expired";
  usageLimit: number;
  usedCount: number;
  enabledAt?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
  notes?: string | null;
};

type GenerateResponse = {
  items: GeneratedItem[];
};

type FormState = {
  count: number | "";
  usageLimit: number | "";
  status: GenStatus;
  validityPeriod: number | ""; // 有效期周期
  validityUnit: "day" | "month" | "year" | ""; // 有效期单位
  notes: string;
  submitting: boolean;
  error?: string;
  successItems?: GeneratedItem[];
};

function parseLocalToUtcIso(local: string): string | null {
  // local 来自 <input type="datetime-local">，例如 "2025-11-02T12:34"
  if (!local) return null;
  // Safari/Chrome：直接 new Date(local) 会按本地时区解析
  const ms = new Date(local).getTime();
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString(); // 输出 UTC ISO
}

function validate(state: FormState): string | null {
  if (state.count === "" || !Number.isFinite(Number(state.count))) return "请输入生成数量";
  const c = Number(state.count);
  if (c < 1 || c > 10000) return "生成数量需在 1–10000 之间";

  if (state.usageLimit === "" || !Number.isFinite(Number(state.usageLimit)))
    return "请输入使用上限";
  const ul = Number(state.usageLimit);
  if (ul < 1) return "使用上限必须 ≥ 1";

  if (!["enabled", "disabled", "suspended"].includes(state.status)) return "非法状态值";

  // 验证有效期字段
  if (state.validityPeriod !== "" || state.validityUnit !== "") {
    if (state.validityPeriod === "" || !Number.isFinite(Number(state.validityPeriod))) {
      return "请输入有效期周期";
    }
    const period = Number(state.validityPeriod);
    if (period <= 0) return "有效期周期必须 > 0";
    if (!state.validityUnit || !["day", "month", "year"].includes(state.validityUnit)) {
      return "请选择有效期单位";
    }
  }

  if (state.notes.length > 500) return "备注长度请 ≤ 500 字符";
  return null;
}

const HelpTip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mt-1 text-xs text-gray-500">{children}</p>
);

const Mono: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="font-mono">{children}</span>
);

export default function ActivationCodesNewPage() {
  const [state, setState] = useState<FormState>({
    count: 100,
    usageLimit: 1,
    status: "enabled",
    validityPeriod: "",
    validityUnit: "",
    notes: "",
    submitting: false,
  });

  const canSubmit = useMemo(() => !state.submitting, [state.submitting]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const v = validate(state);
    if (v) {
      setState((s) => ({ ...s, error: v }));
      return;
    }

    const payload: Record<string, unknown> = {
      count: Number(state.count),
      usageLimit: Number(state.usageLimit),
      status: state.status,
      notes: state.notes ? state.notes.trim() : undefined,
    };
    // 设置有效期字段
    if (state.validityPeriod !== "" && state.validityUnit !== "") {
      payload.validityPeriod = Number(state.validityPeriod);
      payload.validityUnit = state.validityUnit;
    }

    setState((s) => ({ ...s, submitting: true, error: undefined, successItems: undefined }));
    try {
      const data = await apiPost<GenerateResponse, typeof payload>(
        "/api/admin/activation-codes",
        payload,
      );
      // apiClient 已解包 data 字段
      const items = (data as any)?.items ?? (data as any);
      setState((s) => ({
        ...s,
        submitting: false,
        successItems: items as GeneratedItem[],
      }));
    } catch (e) {
      if (e instanceof ApiError) {
        setState((s) => ({
          ...s,
          submitting: false,
          error: `${e.errorCode}: ${e.message}`,
        }));
      } else {
        setState((s) => ({
          ...s,
          submitting: false,
          error: e instanceof Error ? e.message : "未知错误",
        }));
      }
    }
  }

  const fmt = (v?: string | null) =>
    v ? new Date(v).toISOString().replace(".000Z", "Z") : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">批量生成激活码</h2>
        <Link
          href="/admin/activation-codes"
          className="inline-flex items-center rounded-md border border-gray-300 text-sm px-3 py-1.5 hover:bg-gray-100"
        >
          返回列表
        </Link>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-white border border-gray-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700">生成数量（count）</label>
          <input
            type="number"
            min={1}
            max={10000}
            value={state.count}
            onChange={(e) =>
              setState((s) => ({ ...s, count: e.target.value === "" ? "" : Number(e.target.value) }))
            }
            className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            placeholder="1–10000"
          />
          <HelpTip>一次最多生成 10000 条。</HelpTip>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">使用上限（usageLimit）</label>
          <input
            type="number"
            min={1}
            value={state.usageLimit}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                usageLimit: e.target.value === "" ? "" : Number(e.target.value),
              }))
            }
            className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            placeholder="≥ 1"
          />
          <HelpTip>每个激活码可被使用的最大次数。</HelpTip>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">初始状态（status）</label>
          <select
            value={state.status}
            onChange={(e) =>
              setState((s) => ({ ...s, status: e.target.value as GenStatus }))
            }
            className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="enabled">enabled</option>
            <option value="disabled">disabled</option>
            <option value="suspended">suspended</option>
          </select>
          <HelpTip>生成后的默认状态；过期由系统自动写回，不建议手工置为 expired。</HelpTip>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            有效期（validityPeriod + validityUnit）
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={state.validityPeriod}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  validityPeriod: e.target.value === "" ? "" : Number(e.target.value),
                }))
              }
              className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="周期"
            />
            <select
              value={state.validityUnit}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  validityUnit: e.target.value as "day" | "month" | "year" | "",
                }))
              }
              className="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">请选择单位</option>
              <option value="day">天</option>
              <option value="month">月</option>
              <option value="year">年</option>
            </select>
          </div>
          <HelpTip>
            激活码的有效周期（用户激活账户后开始倒计时）。例如：<Mono>30</Mono> + <Mono>天</Mono> =
            激活后 30 天到期。留空表示永久有效。
          </HelpTip>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">备注（notes）</label>
          <textarea
            rows={3}
            maxLength={500}
            value={state.notes}
            onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
            className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            placeholder="可选备注，≤500字"
          />
        </div>

        {state.error && (
          <div className="md:col-span-2 border border-rose-200 bg-rose-50 text-rose-800 text-sm rounded-md px-3 py-2">
            {state.error}
          </div>
        )}

        <div className="md:col-span-2 flex items-center gap-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className={[
              "rounded-md text-sm px-4 py-2",
              canSubmit
                ? "bg-gray-900 text-white hover:bg-black"
                : "bg-gray-300 text-gray-600 cursor-not-allowed",
            ].join(" ")}
          >
            {state.submitting ? "生成中…" : "提交生成"}
          </button>
          <button
            type="button"
            className="rounded-md border border-gray-300 text-sm px-3 py-2 hover:bg-gray-100"
            onClick={() =>
              setState({
                count: 100,
                usageLimit: 1,
                status: "enabled",
                validityPeriod: "",
                validityUnit: "",
                notes: "",
                submitting: false,
                error: undefined,
                successItems: undefined,
              })
            }
          >
            重置
          </button>
        </div>
      </form>

      {/* 生成结果 */}
      {state.successItems && (
        <div className="bg-white border border-emerald-200 rounded-lg">
          <div className="border-b border-emerald-200 px-4 py-2 text-emerald-800 text-sm">
            生成成功，共 {state.successItems.length} 条
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-emerald-50 text-emerald-900">
                <tr>
                  <th className="text-left px-3 py-2 w-20">ID</th>
                  <th className="text-left px-3 py-2">Code</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">UsageLimit</th>
                  <th className="text-left px-3 py-2">UsedCount</th>
                  <th className="text-left px-3 py-2">ExpiresAt</th>
                  <th className="text-left px-3 py-2">CreatedAt</th>
                </tr>
              </thead>
              <tbody>
                {state.successItems.map((it) => (
                  <tr key={it.id} className="border-t border-emerald-100">
                    <td className="px-3 py-2">{it.id}</td>
                    <td className="px-3 py-2 font-mono">{it.code}</td>
                    <td className="px-3 py-2">{it.status}</td>
                    <td className="px-3 py-2">{it.usageLimit}</td>
                    <td className="px-3 py-2">{it.usedCount}</td>
                    <td className="px-3 py-2">{fmt(it.expiresAt)}</td>
                    <td className="px-3 py-2">{fmt(it.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 flex items-center justify-end gap-2">
            <Link
              href="/admin/activation-codes"
              className="inline-flex items-center rounded-md bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-black"
            >
              返回列表
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
