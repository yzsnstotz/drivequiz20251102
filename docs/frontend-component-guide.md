# 🧩 ZALEM 前台系统 - 组件开发指南

**版本**：v1.0  
**更新日期**：2025-11-12

---

## 📋 目录

1. [组件概览](#组件概览)
2. [通用组件](#通用组件)
3. [业务组件](#业务组件)
4. [组件开发规范](#组件开发规范)
5. [可访问性说明](#可访问性说明)

---

## 🎨 组件概览

### 组件分类

- **通用组件** (`src/components/common/`): 可在多个页面复用的基础组件
- **业务组件** (`src/components/vehicle/`, `src/components/service/`): 特定业务领域的组件

### 组件列表

| 组件 | 路径 | 说明 |
|------|------|------|
| `Pagination` | `src/components/common/Pagination.tsx` | 统一分页组件 |
| `FilterBar` | `src/components/common/FilterBar.tsx` | 统一筛选栏组件 |
| `StatusBadge` | `src/components/common/StatusBadge.tsx` | 统一状态徽章组件 |
| `VehicleCard` | `src/components/vehicle/VehicleCard.tsx` | 车辆卡片组件 |
| `ServiceCard` | `src/components/service/ServiceCard.tsx` | 服务卡片组件 |
| `Header` | `src/components/common/Header.tsx` | 顶部导航栏 |
| `AdSlot` | `src/components/common/AdSlot.tsx` | 广告位组件 |
| `AIButton` | `src/components/common/AIButton.tsx` | AI助手按钮 |
| `Toast` | `src/components/common/Toast.tsx` | Toast通知组件 |

---

## 🔧 通用组件

### Pagination

统一分页组件，支持页码跳转和分页信息显示。

**Props**：

```typescript
interface PaginationProps {
  meta: {
    page: number;        // 当前页码
    limit: number;       // 每页数量
    total: number;       // 总条数
    totalPages: number;  // 总页数
  };
  onPageChange: (page: number) => void;  // 页码变化回调
  className?: string;    // 自定义样式类
}
```

**使用示例**：

```tsx
import Pagination, { PaginationMeta } from "@/components/common/Pagination";

const [pagination, setPagination] = useState<PaginationMeta | null>(null);

<Pagination 
  meta={pagination} 
  onPageChange={(page) => {
    setPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }} 
/>
```

**特性**：
- 自动隐藏（当 `totalPages <= 1` 时不渲染）
- 智能页码显示（最多显示7个页码，超出显示省略号）
- 支持上一页/下一页按钮
- 显示分页信息（第 X / Y 页，共 Z 条）

**可访问性**：
- 使用 `aria-label` 标注按钮用途
- 使用 `aria-current="page"` 标注当前页
- 按钮禁用状态使用 `disabled` 属性

---

### FilterBar

统一筛选栏组件，支持车辆和服务两种类型的筛选。

**Props**：

```typescript
interface FilterBarProps {
  filters: VehicleFilters | ServiceFilters;  // 筛选条件
  onChange: (filters: FilterBarFilters) => void;  // 筛选变化回调
  type: "vehicle" | "service";  // 筛选类型
  className?: string;
}

// 车辆筛选条件
interface VehicleFilters {
  brand?: string;      // 品牌
  type?: string;        // 车辆类型
  minPrice?: string;   // 最低价格
  maxPrice?: string;   // 最高价格
}

// 服务筛选条件
interface ServiceFilters {
  category?: string;    // 服务分类
  location?: string;    // 位置
  prefecture?: string;  // 都道府县
  city?: string;        // 城市
}
```

**使用示例**：

```tsx
import FilterBar, { VehicleFilters } from "@/components/common/FilterBar";

const [filters, setFilters] = useState<VehicleFilters>({
  brand: "",
  type: "",
  minPrice: "",
  maxPrice: "",
});

<FilterBar 
  filters={filters} 
  onChange={(newFilters) => {
    setFilters(newFilters);
    setPage(1); // 重置到第一页
  }} 
  type="vehicle" 
/>
```

**特性**：
- 支持展开/收起筛选面板
- 显示活动筛选数量徽章
- 支持一键重置所有筛选
- 受控输入，实时更新筛选条件

**可访问性**：
- 使用语义化标签（`<label>`）
- 输入框支持键盘导航
- 重置按钮使用图标+文字

---

### StatusBadge

统一状态徽章组件，支持4种语义颜色。

**Props**：

```typescript
interface StatusBadgeProps {
  variant: "info" | "success" | "warn" | "error";  // 状态类型
  text?: {
    ja?: string;
    zh?: string;
    en?: string;
    default?: string;
  };  // 多语言文本（可选）
  children?: React.ReactNode;  // 子元素（可选，与text二选一）
  className?: string;
}
```

**使用示例**：

```tsx
import StatusBadge from "@/components/common/StatusBadge";

// 使用多语言文本
<StatusBadge 
  variant="success" 
  text={{ ja: "成功", zh: "成功", en: "Success" }} 
/>

// 使用子元素
<StatusBadge variant="error">
  <span>错误</span>
</StatusBadge>
```

**颜色映射**：
- `info`: 蓝色（`bg-blue-100 text-blue-800`）
- `success`: 绿色（`bg-green-100 text-green-800`）
- `warn`: 黄色（`bg-yellow-100 text-yellow-800`）
- `error`: 红色（`bg-red-100 text-red-800`）

**可访问性**：
- 使用语义化颜色，不依赖颜色传达信息
- 支持多语言文本

---

## 🚗 业务组件

### VehicleCard

车辆卡片组件，用于展示车辆信息。

**Props**：

```typescript
interface VehicleCardProps {
  vehicle: {
    id: number;
    brand: string;
    model: string;
    year?: number;
    name: {
      ja?: string;
      zh?: string;
      en?: string;
    };
    price: {
      min?: number;
      max?: number;
    };
    fuel_type?: string;
    transmission?: string;
    seats?: number;
    image_url?: string;
    type?: {
      name: string;
      name_ja?: string;
      name_zh?: string;
      name_en?: string;
    };
  };
  className?: string;
}
```

**使用示例**：

```tsx
import VehicleCard, { Vehicle } from "@/components/vehicle/VehicleCard";

const vehicles: Vehicle[] = [...];

{vehicles.map((vehicle) => (
  <VehicleCard key={vehicle.id} vehicle={vehicle} />
))}
```

**特性**：
- 自动格式化价格（根据语言）
- 支持多语言显示（名称、类型）
- 图片懒加载（`loading="lazy"`）
- 响应式布局

**可访问性**：
- 图片使用 `alt` 属性
- 链接使用语义化标签
- 支持键盘导航

---

### ServiceCard

服务卡片组件，用于展示服务信息。

**Props**：

```typescript
interface ServiceCardProps {
  service: {
    id: number;
    name: {
      default?: string;
      ja?: string;
      zh?: string;
      en?: string;
    };
    location: {
      prefecture?: string;
      city?: string;
      address?: string;
    };
    price: {
      min?: number;
      max?: number;
      unit?: string;
    };
    rating: {
      avg?: number;
      count?: number;
    };
    image_url?: string;
    category?: {
      name: string;
      name_ja?: string;
      name_zh?: string;
      name_en?: string;
    };
  };
  className?: string;
}
```

**使用示例**：

```tsx
import ServiceCard, { Service } from "@/components/service/ServiceCard";

const services: Service[] = [...];

{services.map((service) => (
  <ServiceCard key={service.id} service={service} />
))}
```

**特性**：
- 显示评分和评价数量
- 显示位置信息（都道府县、城市）
- 自动格式化价格
- 支持多语言显示

**可访问性**：
- 使用图标增强可读性（MapPin、Star）
- 图片使用 `alt` 属性
- 支持键盘导航

---

## 📐 组件开发规范

### 1. Props 定义

- 使用 TypeScript 接口定义 Props
- 所有可选属性必须显式标注 `?`
- 提供默认值（如 `className = ""`）

**示例**：
```typescript
interface MyComponentProps {
  required: string;      // 必需属性
  optional?: number;    // 可选属性
  className?: string;   // 样式类（可选）
}
```

### 2. 多语言支持

- 使用对象形式的多语言文本：`{ ja, zh, en, default }`
- 通过 `useLanguage` Hook 获取当前语言
- 使用 `getLocalizedText` 函数获取对应语言文本

**示例**：
```typescript
import { useLanguage } from "@/lib/i18n";

const { t, language } = useLanguage();

const displayName = t({
  ja: "日本語",
  zh: "中文",
  en: "English",
  default: "中文"
});
```

### 3. 样式规范

- 使用 Tailwind CSS 类名
- 支持 `className` prop 自定义样式
- 响应式设计使用 Tailwind 断点（`md:`, `lg:`）

**示例**：
```tsx
<div className={`base-classes ${className}`}>
  {/* 内容 */}
</div>
```

### 4. 事件处理

- 使用 `onXxx` 命名回调函数（如 `onPageChange`, `onChange`）
- 回调函数接收明确的参数类型
- 避免在组件内部直接修改 props

**示例**：
```typescript
interface MyComponentProps {
  onChange: (value: string) => void;
}

function MyComponent({ onChange }: MyComponentProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };
  // ...
}
```

### 5. 可访问性

- 使用语义化 HTML 标签
- 为交互元素添加 `aria-label` 或 `aria-labelledby`
- 支持键盘导航（Tab、Enter、Space）
- 使用 `disabled` 属性而非 `pointer-events: none`

**示例**：
```tsx
<button
  onClick={handleClick}
  disabled={isDisabled}
  aria-label="上一页"
  aria-current={isCurrent ? "page" : undefined}
>
  上一页
</button>
```

---

## ♿ 可访问性说明

### 键盘导航

所有交互组件支持键盘导航：

- **Tab**: 移动到下一个可聚焦元素
- **Shift+Tab**: 移动到上一个可聚焦元素
- **Enter/Space**: 激活按钮或链接
- **方向键**: 在列表或网格中导航（如适用）

### 屏幕阅读器

- 使用语义化 HTML（`<button>`, `<nav>`, `<main>`）
- 提供 `aria-label` 描述按钮用途
- 使用 `aria-current` 标注当前状态
- 使用 `aria-disabled` 标注禁用状态

### 颜色对比度

- 文本与背景对比度符合 WCAG AA 标准（≥4.5:1）
- 不依赖颜色传达信息（结合图标或文字）

### 响应式设计

- 移动端优先设计
- 使用 Tailwind 响应式断点：
  - `sm:` (640px+)
  - `md:` (768px+)
  - `lg:` (1024px+)
  - `xl:` (1280px+)

---

## 🔍 扩展组件示例

### 添加新的筛选条件

假设需要在车辆筛选栏中添加"燃料类型"筛选：

**步骤 1**: 更新 `VehicleFilters` 接口

```typescript
// src/components/common/FilterBar.tsx
export interface VehicleFilters {
  brand?: string;
  type?: string;
  minPrice?: string;
  maxPrice?: string;
  fuelType?: string;  // 新增
}
```

**步骤 2**: 在 `FilterBar` 组件中添加输入框

```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    燃料类型
  </label>
  <input
    type="text"
    value={vehicleFilters.fuelType || ""}
    onChange={(e) => handleFilterChange("fuelType", e.target.value)}
    placeholder="输入燃料类型..."
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
</div>
```

**步骤 3**: 在页面中使用新的筛选条件

```tsx
// src/app/vehicles/page.tsx
const query: Record<string, string | number> = {
  page,
  limit: 20,
  status: "active",
};
if (filters.fuelType) query.fuelType = filters.fuelType;  // 新增
```

**步骤 4**: 在 API 路由中处理新参数

```typescript
// src/app/api/vehicles/route.ts
const fuelType = searchParams.get("fuelType")?.trim();
if (fuelType) {
  query = query.where("vehicles.fuel_type", "ilike", `%${fuelType}%`);
}
```

---

## 📝 组件测试

### 快照测试

所有组件都应该有快照测试：

```typescript
// tests/components/VehicleCard.spec.tsx
import { render } from "@testing-library/react";
import VehicleCard, { Vehicle } from "@/components/vehicle/VehicleCard";

it("应正确渲染车辆卡片（快照测试）", () => {
  const { container } = render(<VehicleCard vehicle={mockVehicle} />);
  expect(container).toMatchSnapshot();
});
```

### Props 校验测试

测试组件对不同 props 的处理：

```typescript
it("应支持自定义 className", () => {
  const { container } = render(
    <VehicleCard vehicle={mockVehicle} className="custom-class" />
  );
  expect(container.firstChild).toHaveClass("custom-class");
});
```

---

## 🔗 相关文档

- [API 参考文档](./frontend-api-reference.md)
- [统一研发规范](../新前台研发文档/🛠️%20ZALEM%20前台系统%20·%20统一研发规范%20vNext.md)
- [组件源码路径](#组件列表)

---

**最后更新**：2025-11-12  
**维护者**：ZALEM 开发团队

