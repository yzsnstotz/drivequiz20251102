# Datapull 项目结构设计

## 项目概述

datapull 是一个本地服务，用于从各个目标网站抓取信息，然后通过 API 上传到 drivequiz 项目的 RAG 数据库。

## 目录结构

```
datapull/
├── src/
│   ├── crawler/              # 爬虫核心逻辑
│   │   ├── fetcher.ts        # HTTP 请求和 robots.txt 检查
│   │   ├── discoverer.ts     # 链接发现和队列管理
│   │   └── scheduler.ts      # 爬取调度和限流
│   ├── extractors/           # 内容提取器
│   │   ├── html-extractor.ts # HTML 提取
│   │   ├── pdf-extractor.ts  # PDF 提取
│   │   └── base-extractor.ts # 基础提取器接口
│   ├── chunkers/             # 文本分片
│   │   ├── text-chunker.ts   # 文本分片逻辑
│   │   └── chunk-strategy.ts # 分片策略接口
│   ├── ingesters/            # 入库逻辑
│   │   ├── drivequiz-client.ts # DriveQuiz API 客户端
│   │   ├── batch-processor.ts # 批量处理
│   │   └── retry-handler.ts  # 重试处理
│   ├── services/             # 业务服务
│   │   ├── crawl-service.ts  # 爬取服务
│   │   ├── ingest-service.ts # 入库服务
│   │   └── operation-logger.ts # 操作记录服务
│   ├── utils/                # 工具函数
│   │   ├── logger.ts         # 日志工具
│   │   ├── validator.ts      # 配置验证
│   │   ├── hasher.ts         # 内容哈希
│   │   └── encoder.ts        # 编码检测和转换
│   ├── types/                # TypeScript 类型定义
│   │   ├── config.ts         # 配置类型
│   │   ├── document.ts       # 文档类型
│   │   └── api.ts            # API 类型
│   └── main.ts               # 主入口
├── config/                   # 配置文件
│   ├── sources.json          # 抓取源配置
│   └── default.json          # 默认配置
├── scripts/                  # 脚本文件
│   ├── crawl-and-ingest.ts   # 主执行脚本
│   └── validate-config.ts    # 配置验证脚本
├── logs/                     # 日志目录（gitignore）
├── data/                     # 临时数据目录（gitignore）
│   └── cache/                # 缓存文件
├── docs/                     # 文档
│   ├── drivequiz-api-spec.md # API 规范文档
│   ├── drivequiz-api-spec.yaml # OpenAPI 规范
│   └── project-structure.md  # 本文档
├── tests/                    # 测试文件
│   ├── unit/                 # 单元测试
│   └── integration/          # 集成测试
├── .env.example              # 环境变量示例
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

## 模块说明

### 1. Crawler（爬虫模块）

**职责**：
- HTTP 请求和响应处理
- Robots.txt 检查
- 链接发现和队列管理
- 爬取调度和限流

**关键文件**：
- `fetcher.ts`: 处理 HTTP 请求，检查 robots.txt，处理编码
- `discoverer.ts`: 从 HTML 中发现链接，过滤和去重
- `scheduler.ts`: 管理爬取队列，控制并发和限流

### 2. Extractors（提取器模块）

**职责**：
- HTML 到纯文本转换
- PDF 文本提取
- 内容清理和去噪

**关键文件**：
- `html-extractor.ts`: 提取 HTML 主要内容，去除导航、脚本等
- `pdf-extractor.ts`: 提取 PDF 文本内容
- `base-extractor.ts`: 定义提取器接口

### 3. Chunkers（分片模块）

**职责**：
- 文本智能分片
- 保持语义完整性
- 支持多语言分片策略

**关键文件**：
- `text-chunker.ts`: 实现文本分片算法
- `chunk-strategy.ts`: 定义分片策略接口

### 4. Ingesters（入库模块）

**职责**：
- 与 DriveQuiz API 交互
- 批量上传处理
- 错误处理和重试

**关键文件**：
- `drivequiz-client.ts`: DriveQuiz API 客户端封装
- `batch-processor.ts`: 批量文档处理和上传
- `retry-handler.ts`: 重试逻辑处理

### 5. Services（服务模块）

**职责**：
- 业务流程编排
- 操作记录管理
- 错误处理和日志记录

**关键文件**：
- `crawl-service.ts`: 协调爬取流程
- `ingest-service.ts`: 协调入库流程
- `operation-logger.ts`: 记录操作历史

### 6. Utils（工具模块）

**职责**：
- 通用工具函数
- 日志记录
- 配置验证

**关键文件**：
- `logger.ts`: 结构化日志
- `validator.ts`: 配置验证（使用 zod）
- `hasher.ts`: 内容哈希计算
- `encoder.ts`: 编码检测和转换

## 配置文件

### sources.json

定义抓取源配置，包括：
- 种子 URL
- 包含/排除规则
- 元数据（版本、语言等）

### default.json

默认配置，包括：
- 并发数
- 重试次数
- 请求间隔
- 超时设置

## 环境变量

通过 `.env` 文件配置：
- `DRIVEQUIZ_API_URL`: DriveQuiz API 地址
- `DRIVEQUIZ_API_TOKEN`: API Token
- `CRAWL_CONCURRENCY`: 并发数
- `LOG_LEVEL`: 日志级别

## 数据流

```
配置加载 → 爬取 → 提取 → 分片 → 入库 → 记录操作
   ↓         ↓      ↓      ↓      ↓       ↓
sources.json HTTP  HTML  文本   API   本地日志
            robots PDF  分片  上传   数据库
```

## 设计原则

1. **模块化**：每个模块职责单一，易于测试和维护
2. **可扩展**：支持添加新的提取器和分片策略
3. **容错性**：完善的错误处理和重试机制
4. **可观测**：结构化日志和操作记录
5. **配置驱动**：通过配置文件控制行为，无需修改代码

## 技术栈

- **运行时**: Node.js 20+
- **语言**: TypeScript 5+
- **HTTP 客户端**: axios
- **HTML 解析**: cheerio
- **PDF 解析**: pdf-parse
- **配置验证**: zod
- **日志**: winston
- **队列**: p-queue
- **测试**: vitest

