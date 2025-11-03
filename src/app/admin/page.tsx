"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    // 重定向到统计页面
    router.replace("/admin/stats");
  }, [router]);

  return null;
}

