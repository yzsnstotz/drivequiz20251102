// ============================================================
// 测试文件: tests/components/FilterBar.spec.tsx
// 功能: FilterBar 组件测试
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FilterBar, { VehicleFilters, ServiceFilters } from "@/components/common/FilterBar";

describe("FilterBar 组件 - 车辆筛选", () => {
  const mockVehicleFilters: VehicleFilters = {
    brand: "",
    type: "",
    minPrice: "",
    maxPrice: "",
  };

  it("应正确渲染车辆筛选栏", () => {
    const onChange = vi.fn();
    render(<FilterBar filters={mockVehicleFilters} onChange={onChange} type="vehicle" />);

    expect(screen.getByPlaceholderText("搜索品牌或型号...")).toBeInTheDocument();
    expect(screen.getByText("筛选")).toBeInTheDocument();
  });

  it("应在输入品牌时调用 onChange", () => {
    const onChange = vi.fn();
    render(<FilterBar filters={mockVehicleFilters} onChange={onChange} type="vehicle" />);

    const brandInput = screen.getByPlaceholderText("搜索品牌或型号...");
    fireEvent.change(brandInput, { target: { value: "Toyota" } });

    expect(onChange).toHaveBeenCalledWith({ ...mockVehicleFilters, brand: "Toyota" });
  });

  it("应在点击筛选按钮时显示筛选面板", () => {
    const onChange = vi.fn();
    render(<FilterBar filters={mockVehicleFilters} onChange={onChange} type="vehicle" />);

    const filterButton = screen.getByText("筛选");
    fireEvent.click(filterButton);

    expect(screen.getByText("筛选条件")).toBeInTheDocument();
    expect(screen.getByLabelText(/车辆类型/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/最低价格/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/最高价格/i)).toBeInTheDocument();
  });

  it("应在有活动筛选时显示计数徽章", () => {
    const onChange = vi.fn();
    const filtersWithValues: VehicleFilters = {
      brand: "Toyota",
      type: "轿车",
      minPrice: "1000000",
      maxPrice: "",
    };
    render(<FilterBar filters={filtersWithValues} onChange={onChange} type="vehicle" />);

    const filterButton = screen.getByText("筛选");
    expect(filterButton.textContent).toContain("3"); // 3个活动筛选
  });

  it("应在点击重置时清空所有筛选", () => {
    const onChange = vi.fn();
    const filtersWithValues: VehicleFilters = {
      brand: "Toyota",
      type: "轿车",
      minPrice: "1000000",
      maxPrice: "2000000",
    };
    render(<FilterBar filters={filtersWithValues} onChange={onChange} type="vehicle" />);

    const filterButton = screen.getByText("筛选");
    fireEvent.click(filterButton);

    const resetButton = screen.getByText("重置");
    fireEvent.click(resetButton);

    expect(onChange).toHaveBeenCalledWith({
      brand: "",
      type: "",
      minPrice: "",
      maxPrice: "",
    });
  });
});

describe("FilterBar 组件 - 服务筛选", () => {
  const mockServiceFilters: ServiceFilters = {
    category: "",
    location: "",
    prefecture: "",
    city: "",
  };

  it("应正确渲染服务筛选栏", () => {
    const onChange = vi.fn();
    render(<FilterBar filters={mockServiceFilters} onChange={onChange} type="service" />);

    expect(screen.getByPlaceholderText("搜索服务名称或位置...")).toBeInTheDocument();
    expect(screen.getByText("筛选")).toBeInTheDocument();
  });

  it("应在输入位置时调用 onChange", () => {
    const onChange = vi.fn();
    render(<FilterBar filters={mockServiceFilters} onChange={onChange} type="service" />);

    const locationInput = screen.getByPlaceholderText("搜索服务名称或位置...");
    fireEvent.change(locationInput, { target: { value: "东京" } });

    expect(onChange).toHaveBeenCalledWith({ ...mockServiceFilters, location: "东京" });
  });

  it("应在点击筛选按钮时显示筛选面板", () => {
    const onChange = vi.fn();
    render(<FilterBar filters={mockServiceFilters} onChange={onChange} type="service" />);

    const filterButton = screen.getByText("筛选");
    fireEvent.click(filterButton);

    expect(screen.getByText("筛选条件")).toBeInTheDocument();
    expect(screen.getByLabelText(/服务分类/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/都道府县/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/城市/i)).toBeInTheDocument();
  });

  it("应在有活动筛选时显示计数徽章", () => {
    const onChange = vi.fn();
    const filtersWithValues: ServiceFilters = {
      category: "驾校",
      location: "",
      prefecture: "东京都",
      city: "新宿区",
    };
    render(<FilterBar filters={filtersWithValues} onChange={onChange} type="service" />);

    const filterButton = screen.getByText("筛选");
    expect(filterButton.textContent).toContain("2"); // 2个活动筛选
  });
});

