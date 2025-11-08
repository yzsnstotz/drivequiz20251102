"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * 统一分页组件
 * 统一 props：meta{page,limit,total,totalPages}，onPageChange(page)
 */
export default function Pagination({ meta, onPageChange, className = "" }: PaginationProps) {
  const { page, totalPages, total } = meta;

  if (totalPages <= 1) {
    return null;
  }

  const handlePrev = () => {
    if (page > 1) {
      onPageChange(page - 1);
    }
  };

  const handleNext = () => {
    if (page < totalPages) {
      onPageChange(page + 1);
    }
  };

  const handlePageClick = (targetPage: number) => {
    if (targetPage >= 1 && targetPage <= totalPages && targetPage !== page) {
      onPageChange(targetPage);
    }
  };

  // 计算显示的页码范围
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      // 如果总页数少于等于7页，显示所有页码
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 总是显示第一页
      pages.push(1);

      if (page <= 4) {
        // 当前页在前4页
        for (let i = 2; i <= 5; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      } else if (page >= totalPages - 3) {
        // 当前页在后4页
        pages.push("ellipsis");
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // 当前页在中间
        pages.push("ellipsis");
        for (let i = page - 1; i <= page + 1; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={`flex items-center justify-center space-x-2 ${className}`}>
      {/* 上一页按钮 */}
      <button
        onClick={handlePrev}
        disabled={page === 1}
        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
        aria-label="上一页"
      >
        <ChevronLeft className="h-4 w-4" />
        <span>上一页</span>
      </button>

      {/* 页码按钮 */}
      <div className="flex items-center space-x-1">
        {pageNumbers.map((pageNum, index) => {
          if (pageNum === "ellipsis") {
            return (
              <span key={`ellipsis-${index}`} className="px-2 text-gray-500">
                ...
              </span>
            );
          }

          const pageNumber = pageNum as number;
          const isActive = pageNumber === page;

          return (
            <button
              key={pageNumber}
              onClick={() => handlePageClick(pageNumber)}
              className={`px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-600 text-white font-semibold"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
              aria-label={`第 ${pageNumber} 页`}
              aria-current={isActive ? "page" : undefined}
            >
              {pageNumber}
            </button>
          );
        })}
      </div>

      {/* 下一页按钮 */}
      <button
        onClick={handleNext}
        disabled={page === totalPages}
        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
        aria-label="下一页"
      >
        <span>下一页</span>
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* 页码信息 */}
      <span className="px-4 py-2 text-sm text-gray-600">
        第 {page} / {totalPages} 页（共 {total} 条）
      </span>
    </div>
  );
}

