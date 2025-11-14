# 多语言数据格式兼容性说明

## 概述

本文档说明数据库格式从单语言字符串改为多语言JSONB对象后，系统如何确保前后台功能正常工作。

## 数据格式变化

### 旧格式（兼容）
```typescript
content: string  // 例如: "7. 图中标志是禁止泊车的标志。"
```

### 新格式
```typescript
content: {
  zh: string;  // 中文
  en?: string; // 英文（可选）
  ja?: string; // 日文（可选）
  [key: string]: string | undefined;
}
```

## 兼容性处理策略

### 1. 工具函数

创建了 `src/lib/questionContentUtils.ts` 提供统一的处理函数：

- `getContentText()`: 获取指定语言的文本内容
- `getContentTextLower()`: 获取小写文本（用于搜索）
- `contentIncludes()`: 检查是否包含指定文本
- `getContentPreview()`: 获取内容预览（用于日志）
- `normalizeContent()`: 规范化content字段（确保是多语言对象）

### 2. 数据库读取

所有从数据库读取题目的地方都已更新：

#### `src/lib/questionDb.ts`
- `getQuestionsFromDb()`: 保持原格式返回（字符串或多语言对象）
- `saveQuestionToDb()`: 自动将字符串转换为多语言对象
- `updateAllJsonPackages()`: 正确处理多语言content

#### `src/app/api/admin/questions/route.ts`
- `collectAllQuestions()`: 保持原格式
- 搜索功能：使用 `getContentText()` 处理多语言
- 排序功能：使用 `getContentText()` 处理多语言

#### `src/app/api/admin/questions/[id]/route.ts`
- `findQuestionCategory()`: 保持原格式
- 日志记录：使用 `getContentText()` 获取预览

#### `src/app/api/admin/questions/import-from-json/route.ts`
- 导入时自动规范化content字段

### 3. 前台显示

#### `src/components/QuestionPage.tsx`
- 使用 `getQuestionContent()` 和 `getQuestionOptions()` 获取多语言内容
- 根据用户选择的语言自动切换

#### `src/components/QuestionAIDialog.tsx`
- 处理多语言content显示
- 格式化题目时使用中文作为默认

#### `src/app/mistakes/MistakeBookPage.tsx`
- 处理多语言content显示和搜索

### 4. 后台管理

#### `src/app/admin/questions/page.tsx`
- 列表显示：自动提取中文内容显示
- 表单编辑：从多语言对象提取中文作为默认值
- 创建/更新：提交时自动转换为多语言对象

### 5. API路由

所有API路由都已更新以支持多语言：

- `GET /api/admin/questions`: 支持多语言搜索和排序
- `GET /api/admin/questions/:id`: 返回多语言格式
- `PUT /api/admin/questions/:id`: 接受字符串或多语言对象
- `POST /api/admin/questions`: 接受字符串，自动转换
- `GET /api/exam/[set]`: 保持原格式返回

## 兼容性保证

### 读取兼容性
- ✅ 如果数据库中是字符串，直接使用
- ✅ 如果数据库中是JSONB对象，提取对应语言
- ✅ 如果目标语言不存在，回退到中文
- ✅ 如果中文也不存在，使用第一个可用语言

### 写入兼容性
- ✅ 接受字符串输入，自动转换为 `{zh: string}`
- ✅ 接受多语言对象，直接保存
- ✅ 保存时确保至少包含 `zh` 字段

### 搜索兼容性
- ✅ 搜索时使用指定语言的内容
- ✅ 如果指定语言不存在，使用中文
- ✅ 支持大小写不敏感搜索

### 显示兼容性
- ✅ 前台根据用户语言选择显示对应内容
- ✅ 后台默认显示中文内容
- ✅ 所有显示位置都正确处理多语言格式

## 测试建议

### 1. 数据库迁移测试
```sql
-- 运行迁移脚本
\i src/migrations/20250120_update_questions_multilang_tags.sql
\i src/migrations/20250120_add_tags_to_related_tables.sql
```

### 2. 功能测试清单

#### 前台功能
- [ ] 首页语言切换
- [ ] 题目显示（单语言和多语言）
- [ ] 题目搜索
- [ ] 错题本显示
- [ ] AI助手显示题目

#### 后台功能
- [ ] 题目列表显示
- [ ] 题目搜索
- [ ] 题目排序
- [ ] 题目创建
- [ ] 题目编辑
- [ ] 题目导入
- [ ] 题目删除

#### API测试
- [ ] GET /api/admin/questions（搜索、排序）
- [ ] GET /api/admin/questions/:id
- [ ] POST /api/admin/questions
- [ ] PUT /api/admin/questions/:id
- [ ] GET /api/exam/[set]

## 注意事项

1. **数据迁移**: 迁移脚本会自动将现有TEXT内容转换为JSONB格式 `{zh: content}`
2. **向后兼容**: 代码支持两种格式，但建议新数据使用多语言格式
3. **性能**: 多语言对象查询使用GIN索引，性能良好
4. **标签同步**: 相关表的标签字段通过触发器自动同步

## 相关文件

- `src/lib/questionContentUtils.ts` - 内容处理工具函数
- `src/lib/questionUtils.ts` - 题目多语言工具函数
- `src/lib/questionDb.ts` - 数据库操作（已更新）
- `src/migrations/20250120_update_questions_multilang_tags.sql` - 数据库迁移
- `src/migrations/20250120_add_tags_to_related_tables.sql` - 相关表迁移

