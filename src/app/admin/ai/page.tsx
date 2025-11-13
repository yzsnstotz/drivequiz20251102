"use client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";

export default function AdminAiHub() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">AI 管理 · 总览</h1>
      <p className="text-sm text-neutral-500">进入子模块进行运维与监控。</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { href: "/admin/ai/monitor", title: "每日摘要看板", desc: "调用量 / 命中率 / 成本 / Top 问题" },
          { href: "/admin/ai/logs", title: "问答日志", desc: "按条件查询 AI 日志明细" },
          { href: "/admin/ai/filters", title: "过滤规则", desc: "禁答/非相关关键词配置" },
          { href: "/admin/ai/config", title: "配置中心", desc: "可读写核心运营参数并即时生效" },
          { href: "/admin/ai/scenes", title: "场景配置", desc: "不同 AI 场景的 Prompt 和格式配置" },
          { href: "/admin/ai/rag", title: "知识库上传", desc: "法规文档上传 → 向量化" },
          { href: "/admin/ai/rag/list", title: "文档列表", desc: "可见文档列表、版本/状态切换、重建向量" },
        ].map((x) => (
          <Link key={x.href} href={x.href} className="border rounded-lg p-4 hover:bg-neutral-50">
            <div className="font-medium">{x.title}</div>
            <div className="text-xs text-neutral-500 mt-1">{x.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
