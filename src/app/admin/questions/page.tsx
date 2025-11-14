export const dynamic = "force-dynamic";

import Link from "next/link";

export default function QuestionsHub() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">题目管理 · 总览</h1>
      <p className="text-sm text-neutral-500">进入子模块进行题目管理与处理。</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { href: "/admin/questions/list", title: "题目列表", desc: "查看、编辑、导入题目数据" },
          { href: "/admin/question-processing", title: "批量处理", desc: "批量翻译、润色、补漏、分类标签" },
          { href: "/admin/polish-reviews", title: "润色确认", desc: "审核 AI 润色后的题目内容" },
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
