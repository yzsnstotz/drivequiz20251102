# 📚 ZALEM 前台系统 - API 参考文档

**版本**：v1.0  
**更新日期**：2025-11-12  
**基础路径**：`/api`

---

## 📋 目录

1. [通用规范](#通用规范)
2. [用户相关 API](#用户相关-api)
3. [车辆相关 API](#车辆相关-api)
4. [服务相关 API](#服务相关-api)
5. [题目相关 API](#题目相关-api)
6. [广告相关 API](#广告相关-api)
7. [用户行为 API](#用户行为-api)
8. [错误码说明](#错误码说明)

---

## 🔧 通用规范

### 请求格式

- **Content-Type**: `application/json`
- **认证**: 部分接口需要 JWT Token（`Authorization: Bearer <token>`）

### 响应格式

**成功响应**：
```json
{
  "ok": true,
  "data": { ... },
  "pagination": { ... }  // 可选，分页接口包含
}
```

**错误响应**：
```json
{
  "ok": false,
  "errorCode": "ERROR_CODE",
  "message": "错误描述"
}
```

### 分页参数

所有列表接口支持以下分页参数：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码（≥1） |
| `limit` | number | 20 | 每页数量（1-100） |

**分页响应**：
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 排序参数

部分接口支持排序：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sortBy` | string | - | 排序字段（白名单限制） |
| `order` | "asc" \| "desc" | "desc" | 排序方向 |

---

## 👤 用户相关 API

### GET /api/profile

获取当前用户资料。

**认证**：必需（JWT Token）

**响应**：
```json
{
  "ok": true,
  "data": {
    "language": "ja",
    "goals": [],
    "level": "beginner",
    "metadata": {
      "privacy": {
        "shareData": false,
        "analytics": true
      },
      "notifications": {
        "email": false,
        "push": true
      }
    },
    "created_at": "2025-11-12T00:00:00Z",
    "updated_at": "2025-11-12T00:00:00Z"
  }
}
```

**错误码**：
- `AUTH_REQUIRED` (401): 需要登录
- `INTERNAL_ERROR` (500): 服务器内部错误

**示例**：
```bash
curl -X GET "http://localhost:3000/api/profile" \
  -H "Authorization: Bearer <token>"
```

---

### PUT /api/profile

更新用户资料。

**认证**：必需（JWT Token）

**请求体**：
```json
{
  "language": "ja",
  "goals": ["goal1", "goal2"],
  "level": "beginner",
  "metadata": {
    "privacy": {
      "shareData": false,
      "analytics": true
    },
    "notifications": {
      "email": false,
      "push": true
    }
  }
}
```

**字段说明**：
- `language`: 语言代码（"ja" | "zh" | "en"）
- `goals`: 目标数组（字符串数组）
- `level`: 等级（"beginner" | "intermediate" | "advanced" | "expert"）
- `metadata`: 元数据对象（可选）

**响应**：同 GET /api/profile

**错误码**：
- `AUTH_REQUIRED` (401): 需要登录
- `VALIDATION_FAILED` (400): 参数验证失败
- `INTERNAL_ERROR` (500): 服务器内部错误

**示例**：
```bash
curl -X PUT "http://localhost:3000/api/profile" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"language":"ja","metadata":{"privacy":{"shareData":false}}}'
```

---

### GET /api/interests

获取用户兴趣偏好。

**认证**：必需（JWT Token）

**响应**：
```json
{
  "ok": true,
  "data": {
    "vehicle_brands": ["Toyota", "Honda"],
    "service_types": ["inspection", "repair"],
    "other_interests": {},
    "created_at": "2025-11-12T00:00:00Z",
    "updated_at": "2025-11-12T00:00:00Z"
  }
}
```

**示例**：
```bash
curl -X GET "http://localhost:3000/api/interests" \
  -H "Authorization: Bearer <token>"
```

---

### PUT /api/interests

更新用户兴趣偏好。

**认证**：必需（JWT Token）

**请求体**：
```json
{
  "vehicle_brands": ["Toyota", "Honda"],
  "service_types": ["inspection", "repair"],
  "other_interests": {}
}
```

**示例**：
```bash
curl -X PUT "http://localhost:3000/api/interests" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"vehicle_brands":["Toyota"],"service_types":["inspection"]}'
```

---

## 🚗 车辆相关 API

### GET /api/vehicles

获取车辆列表。

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 页码（默认1） |
| `limit` | number | 每页数量（默认20，最大100） |
| `brand` | string | 品牌筛选 |
| `type` | string | 车辆类型筛选 |
| `minPrice` | number | 最低价格 |
| `maxPrice` | number | 最高价格 |
| `status` | string | 状态（默认"active"） |

**响应**：
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "brand": "Toyota",
      "model": "Camry",
      "year": 2023,
      "name": {
        "ja": "トヨタ カムリ",
        "zh": "丰田 凯美瑞",
        "en": "Toyota Camry"
      },
      "price": {
        "min": 2000000,
        "max": 3000000
      },
      "fuel_type": "汽油",
      "transmission": "自动",
      "seats": 5,
      "image_url": "https://example.com/car.jpg",
      "type": {
        "name": "轿车",
        "name_ja": "セダン",
        "name_zh": "轿车",
        "name_en": "Sedan"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**示例**：
```bash
curl "http://localhost:3000/api/vehicles?page=1&limit=5&brand=Toyota"
```

---

### GET /api/vehicles/[id]

获取车辆详情。

**路径参数**：
- `id`: 车辆ID

**响应**：单个车辆对象（同列表中的车辆对象）

**示例**：
```bash
curl "http://localhost:3000/api/vehicles/1"
```

---

## 🏢 服务相关 API

### GET /api/services

获取服务列表。

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 页码（默认1） |
| `limit` | number | 每页数量（默认20，最大100） |
| `category` | string | 服务分类筛选 |
| `location` | string | 位置筛选 |
| `prefecture` | string | 都道府县筛选 |
| `city` | string | 城市筛选 |
| `status` | string | 状态（默认"active"） |

**响应**：
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "name": {
        "default": "驾校服务",
        "ja": "教習所サービス",
        "zh": "驾校服务",
        "en": "Driving School Service"
      },
      "location": {
        "prefecture": "东京都",
        "city": "新宿区",
        "address": "新宿1-1-1"
      },
      "price": {
        "min": 300000,
        "max": 500000,
        "unit": "日元"
      },
      "rating": {
        "avg": 4.5,
        "count": 120
      },
      "image_url": "https://example.com/service.jpg",
      "category": {
        "name": "驾校",
        "name_ja": "教習所",
        "name_zh": "驾校",
        "name_en": "Driving School"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

**示例**：
```bash
curl "http://localhost:3000/api/services?category=inspection&page=1&prefecture=东京都"
```

---

### GET /api/services/[id]

获取服务详情。

**路径参数**：
- `id`: 服务ID

**响应**：单个服务对象（同列表中的服务对象）

**示例**：
```bash
curl "http://localhost:3000/api/services/1"
```

---

## 📝 题目相关 API

### GET /api/exam/[set]

获取题目列表（支持多驾照类型）。

**路径参数**：
- `set`: 题目集ID（如："1", "仮免-1", "免许-1"）

**查询参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `licenseType` | string | "provisional" | 驾照类型（"provisional" \| "regular" \| "学科講習"） |
| `page` | number | 1 | 页码 |
| `limit` | number | 50 | 每页数量（最大100） |
| `sortBy` | string | "id" | 排序字段（"id" \| "created_at"） |
| `order` | "asc" \| "desc" | "desc" | 排序方向 |

**响应**：
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "type": "single",
      "content": "题目内容",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "correctAnswer": "选项A",
      "image": "https://example.com/image.jpg",
      "explanation": "解析说明",
      "category": "交通规则"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 200,
    "totalPages": 4
  }
}
```

**题目类型**：
- `single`: 单选题
- `multiple`: 多选题
- `truefalse`: 判断题

**错误码**：
- `VALIDATION_FAILED` (400): 参数验证失败（无效的licenseType或sortBy）
- `NOT_FOUND` (404): 题目集不存在
- `INVALID_DATA` (500): 题目文件格式错误
- `INTERNAL_ERROR` (500): 服务器内部错误

**示例**：
```bash
# 获取仮免许题目
curl "http://localhost:3000/api/exam/1?licenseType=provisional&page=1&limit=50"

# 获取正式免许题目
curl "http://localhost:3000/api/exam/1?licenseType=regular&page=1&limit=50"

# 获取学科講習题目
curl "http://localhost:3000/api/exam/1?licenseType=学科講習&page=1&limit=50"
```

---

## 📢 广告相关 API

### GET /api/ads

获取广告内容。

**查询参数**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `position` | string | ✅ | 广告位位置（如："license_top", "vehicle_list"） |

**响应**：
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "slot": {
      "id": 1,
      "position": "license_top",
      "name": "驾照页面顶部"
    },
    "title": {
      "default": "广告标题",
      "ja": "広告タイトル",
      "zh": "广告标题",
      "en": "Ad Title"
    },
    "image_url": "https://example.com/ad.jpg",
    "link_url": "https://example.com",
    "impression_count": 1000,
    "click_count": 50
  }
}
```

**广告位位置**：
- `license_top`: 驾照页面顶部
- `license_study`: 学习页面
- `license_exam`: 考试页面
- `vehicle_list`: 车辆列表页
- `service_list`: 服务列表页

**示例**：
```bash
curl "http://localhost:3000/api/ads?slot=license_top"
```

---

## 📊 用户行为 API

### POST /api/user-behaviors

记录用户行为。

**认证**：必需（JWT Token）

**请求体**：
```json
{
  "behaviorType": "view_page",
  "metadata": {
    "page": "/vehicles",
    "referrer": "/"
  },
  "userAgent": "Mozilla/5.0...",
  "clientType": "web"
}
```

**行为类型**：
- `start_quiz`: 开始答题
- `complete_quiz`: 完成答题
- `pause_quiz`: 暂停答题
- `resume_quiz`: 恢复答题
- `view_page`: 查看页面
- `ai_chat`: AI对话
- `other`: 其他

**客户端类型**：
- `web`: Web浏览器
- `mobile`: 移动端
- `api`: API调用
- `desktop`: 桌面应用
- `other`: 其他

**响应**：
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "behaviorType": "view_page",
    "created_at": "2025-11-12T00:00:00Z"
  }
}
```

**错误码**：
- `NO_TOKEN` (401): 需要用户认证
- `INVALID_BEHAVIOR_TYPE` (400): 无效的行为类型
- `INTERNAL_ERROR` (500): 服务器内部错误

**示例**：
```bash
curl -X POST "http://localhost:3000/api/user-behaviors" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"behaviorType":"view_page","metadata":{"page":"/vehicles"}}'
```

---

## ❌ 错误码说明

### 认证错误

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| `AUTH_REQUIRED` | 401 | 需要登录才能访问此资源 |
| `NO_TOKEN` | 401 | 需要用户认证 |

### 验证错误

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| `VALIDATION_FAILED` | 400 | 参数验证失败（详细说明见message） |

### 资源错误

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| `NOT_FOUND` | 404 | 资源不存在 |

### 数据错误

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| `INVALID_DATA` | 500 | 数据格式错误 |
| `INVALID_BEHAVIOR_TYPE` | 400 | 无效的行为类型 |

### 服务器错误

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

---

## 🔍 测试示例

### 完整测试脚本

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"
TOKEN="your-token-here"

# 1. 获取车辆列表
echo "=== 测试车辆列表 ==="
curl -sS "${BASE_URL}/api/vehicles?page=1&limit=5" | jq '.ok, .pagination'

# 2. 获取服务列表
echo "=== 测试服务列表 ==="
curl -sS "${BASE_URL}/api/services?category=inspection&page=1" | jq '.ok, .pagination'

# 3. 获取题目列表
echo "=== 测试题目列表 ==="
curl -sS "${BASE_URL}/api/exam/1?licenseType=provisional&page=1&limit=10" | jq '.ok, .pagination'

# 4. 更新用户资料
echo "=== 测试更新用户资料 ==="
curl -sS -X PUT "${BASE_URL}/api/profile" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"language":"ja","nickname":"Leo"}' | jq '.ok'

# 5. 获取广告
echo "=== 测试广告 ==="
curl -sS "${BASE_URL}/api/ads?slot=license_top" | jq '.ok, .data[0].slot'

# 6. 记录用户行为
echo "=== 测试用户行为 ==="
curl -sS -X POST "${BASE_URL}/api/user-behaviors" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"behaviorType":"view_page","metadata":{"page":"/vehicles"}}' | jq '.ok'
```

---

## 📝 注意事项

1. **排序白名单**：所有支持排序的接口都有字段白名单限制，禁止透传任意字段
2. **分页限制**：`limit` 参数最大值为 100，超过会自动限制为 100
3. **缓存策略**：列表接口默认 `revalidate: 60`，避免频繁请求
4. **响应时间**：开发环境下会在控制台输出响应时间日志（`console.warn`）

---

**最后更新**：2025-11-12  
**维护者**：ZALEM 开发团队

