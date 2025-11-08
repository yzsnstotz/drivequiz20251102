// ============================================================
// 测试文件: tests/components/Pagination.spec.tsx
// 功能: Pagination 组件测试
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Pagination, { PaginationMeta } from "@/components/common/Pagination";

describe("Pagination 组件", () => {
  const mockMeta: PaginationMeta = {
    page: 1,
    limit: 20,
    total: 100,
    totalPages: 5,
  };

  it("应正确渲染分页信息", () => {
    const onPageChange = vi.fn();
    render(<Pagination meta={mockMeta} onPageChange={onPageChange} />);

    expect(screen.getByText("第 1 / 5 页")).toBeInTheDocument();
    expect(screen.getByLabelText("上一页")).toBeInTheDocument();
    expect(screen.getByLabelText("下一页")).toBeInTheDocument();
  });

  it("应在第一页时禁用上一页按钮", () => {
    const onPageChange = vi.fn();
    render(<Pagination meta={mockMeta} onPageChange={onPageChange} />);

    const prevButton = screen.getByLabelText("上一页");
    expect(prevButton).toBeDisabled();
  });

  it("应在最后一页时禁用下一页按钮", () => {
    const onPageChange = vi.fn();
    const lastPageMeta: PaginationMeta = {
      ...mockMeta,
      page: 5,
    };
    render(<Pagination meta={lastPageMeta} onPageChange={onPageChange} />);

    const nextButton = screen.getByLabelText("下一页");
    expect(nextButton).toBeDisabled();
  });

  it("应调用 onPageChange 当点击下一页", () => {
    const onPageChange = vi.fn();
    render(<Pagination meta={mockMeta} onPageChange={onPageChange} />);

    const nextButton = screen.getByLabelText("下一页");
    fireEvent.click(nextButton);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("应调用 onPageChange 当点击上一页", () => {
    const onPageChange = vi.fn();
    const page2Meta: PaginationMeta = {
      ...mockMeta,
      page: 2,
    };
    render(<Pagination meta={page2Meta} onPageChange={onPageChange} />);

    const prevButton = screen.getByLabelText("上一页");
    fireEvent.click(prevButton);

    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("应在 totalPages <= 1 时不渲染", () => {
    const onPageChange = vi.fn();
    const singlePageMeta: PaginationMeta = {
      ...mockMeta,
      totalPages: 1,
    };
    const { container } = render(<Pagination meta={singlePageMeta} onPageChange={onPageChange} />);

    expect(container.firstChild).toBeNull();
  });

  it("应支持自定义 className", () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <Pagination meta={mockMeta} onPageChange={onPageChange} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});

