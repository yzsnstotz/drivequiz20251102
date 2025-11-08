// ============================================================
// 测试文件: tests/components/VehicleCard.spec.tsx
// 功能: VehicleCard 组件测试（快照测试）
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import VehicleCard, { Vehicle } from "@/components/vehicle/VehicleCard";

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

describe("VehicleCard 组件", () => {
  const mockVehicle: Vehicle = {
    id: 1,
    brand: "Toyota",
    model: "Camry",
    year: 2023,
    name: {
      ja: "トヨタ カムリ",
      zh: "丰田 凯美瑞",
      en: "Toyota Camry",
    },
    price: {
      min: 2000000,
      max: 3000000,
    },
    fuel_type: "汽油",
    transmission: "自动",
    seats: 5,
    image_url: "https://example.com/car.jpg",
    type: {
      name: "轿车",
      name_ja: "セダン",
      name_zh: "轿车",
      name_en: "Sedan",
    },
  };

  it("应正确渲染车辆卡片（快照测试）", () => {
    const { container } = render(<VehicleCard vehicle={mockVehicle} />);
    expect(container).toMatchSnapshot();
  });

  it("应正确渲染无图片的车辆卡片", () => {
    const vehicleWithoutImage = {
      ...mockVehicle,
      image_url: undefined,
    };
    const { container } = render(<VehicleCard vehicle={vehicleWithoutImage} />);
    expect(container).toMatchSnapshot();
  });

  it("应正确渲染无价格的车辆卡片", () => {
    const vehicleWithoutPrice = {
      ...mockVehicle,
      price: undefined,
    };
    const { container } = render(<VehicleCard vehicle={vehicleWithoutPrice} />);
    expect(container).toMatchSnapshot();
  });

  it("应支持自定义 className", () => {
    const { container } = render(<VehicleCard vehicle={mockVehicle} className="custom-class" />);
    expect(container.firstChild).toHaveClass("custom-class");
  });
});

