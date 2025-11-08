# 安全说明

## xlsx 包安全漏洞

项目使用的 `xlsx@0.18.5` 包存在以下已知安全漏洞：

1. **GHSA-4r6h-8v6p-xvw6**: Prototype Pollution in sheetJS
2. **GHSA-5pgg-2g8v-p4x9**: SheetJS Regular Expression Denial of Service (ReDoS)

### 风险评估

- **风险等级**: High
- **影响范围**: 仅限管理员后台的 Excel 导入功能
- **使用场景**: 
  - 管理员上传题目 Excel 文件
  - 生成题目导入模板
  - 不处理用户输入或不可信数据

### 缓解措施

1. **限制访问**: Excel 导入功能仅限管理员使用，需要管理员权限
2. **输入验证**: 对上传的 Excel 文件进行严格验证
3. **监控**: 定期检查是否有新版本发布

### 未来计划

- 监控 `xlsx` 包的更新，一旦有修复版本立即升级
- 考虑迁移到替代包（如 `exceljs`）如果漏洞长期未修复

### 当前状态

- ✅ 已配置 `.npmrc` 将 audit-level 设置为 moderate
- ✅ 已添加此文档说明
- ⚠️ 等待上游修复或考虑替代方案

