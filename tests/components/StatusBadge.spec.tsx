// ============================================================
// 测试文件: tests/components/StatusBadge.spec.tsx
// 功能: StatusBadge 组件测试
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge from "@/components/common/StatusBadge";

// Mock useLanguage hook
vi.mock("@/lib/i18n", () => ({
  useLanguage: () => ({
    t: (obj: { ja?: string; zh?: string; en?: string }) => obj.zh || obj.ja || obj.en || "",
    language: "zh" as const,
    setLanguage: vi.fn(),
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("StatusBadge 组件", () => {
  it("应正确渲染 info 类型", () => {
    render(
      <StatusBadge
        variant="info"
        text={{ ja: "情報", zh: "信息", en: "Info" }}
      />
    );

    const badge = screen.getByText("信息");
    expect(badge).toHaveClass("bg-blue-100", "text-blue-800");
  });

  it("应正确渲染 success 类型", () => {
    render(
      <StatusBadge
        variant="success"
        text={{ ja: "成功", zh: "成功", en: "Success" }}
      />
    );

    const badge = screen.getByText("成功");
    expect(badge).toHaveClass("bg-green-100", "text-green-800");
  });

  it("应正确渲染 warn 类型", () => {
    render(
      <StatusBadge
        variant="warn"
        text={{ ja: "警告", zh: "警告", en: "Warning" }}
      />
    );

    const badge = screen.getByText("警告");
    expect(badge).toHaveClass("bg-yellow-100", "text-yellow-800");
  });

  it("应正确渲染 error 类型", () => {
    render(
      <StatusBadge
        variant="error"
        text={{ ja: "エラー", zh: "错误", en: "Error" }}
      />
    );

    const badge = screen.getByText("错误");
    expect(badge).toHaveClass("bg-red-100", "text-red-800");
  });

  it("应支持 children 内容", () => {
    render(
      <StatusBadge variant="info">
        <span>自定义内容</span>
      </StatusBadge>
    );

    expect(screen.getByText("自定义内容")).toBeInTheDocument();
  });

  it("应支持自定义 className", () => {
    const { container } = render(
      <StatusBadge
        variant="info"
        text={{ zh: "测试" }}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});

