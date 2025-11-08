// ============================================================
// 测试文件: tests/components/ServiceCard.spec.tsx
// 功能: ServiceCard 组件测试（快照测试）
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import ServiceCard, { Service } from "@/components/service/ServiceCard";

// Mock useLanguage hook
vi.mock("@/lib/i18n", () => ({
  useLanguage: () => ({
    t: (obj: { ja?: string; zh?: string; en?: string }) => obj.zh || obj.ja || obj.en || "",
    language: "zh" as const,
    setLanguage: vi.fn(),
  }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("ServiceCard 组件", () => {
  const mockService: Service = {
    id: 1,
    name: {
      default: "驾校服务",
      ja: "教習所サービス",
      zh: "驾校服务",
      en: "Driving School Service",
    },
    location: {
      prefecture: "东京都",
      city: "新宿区",
      address: "新宿1-1-1",
    },
    price: {
      min: 300000,
      max: 500000,
      unit: "日元",
    },
    rating: {
      avg: 4.5,
      count: 120,
    },
    image_url: "https://example.com/service.jpg",
    category: {
      name: "驾校",
      name_ja: "教習所",
      name_zh: "驾校",
      name_en: "Driving School",
    },
  };

  it("应正确渲染服务卡片（快照测试）", () => {
    const { container } = render(<ServiceCard service={mockService} />);
    expect(container).toMatchSnapshot();
  });

  it("应正确渲染无图片的服务卡片", () => {
    const serviceWithoutImage = {
      ...mockService,
      image_url: undefined,
    };
    const { container } = render(<ServiceCard service={serviceWithoutImage} />);
    expect(container).toMatchSnapshot();
  });

  it("应正确渲染无评分和服务卡片", () => {
    const serviceWithoutRating = {
      ...mockService,
      rating: undefined,
    };
    const { container } = render(<ServiceCard service={serviceWithoutRating} />);
    expect(container).toMatchSnapshot();
  });

  it("应支持自定义 className", () => {
    const { container } = render(<ServiceCard service={mockService} className="custom-class" />);
    expect(container.firstChild).toHaveClass("custom-class");
  });
});

