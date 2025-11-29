# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `render.yaml` - Render 部署配置文件，包含 Web 服务和 Cron 作业配置
- `src/migrations/20251103_ai_core.sql` - AI 核心表迁移脚本（ai_logs, ai_filters, ai_rag_docs, ai_daily_summary, ai_vectors）
- `src/migrations/20251103_ai_rpc.sql` - AI RPC 函数迁移脚本（match_documents）
- `src/migrations/20251103_ai_rls.sql` - AI RLS 策略迁移脚本

### Changed
- `scripts/smoke-ai.sh` - 更新为 Render 版本，简化测试用例
- `驾考AI开发文档/🏠当前研发进度与衔接说明 v1.8.md` - 平台从 Railway 切换为 Render，新增 render.yaml 说明
- `驾考AI开发文档/🧩 ZALEM · AI问答模块 研发文档 v1.0.md` - 部署平台从 Railway 更新为 Render
- `驾考AI开发文档/🛠️ ZALEM · AI问答模块 研发规范 v1.0.md` - 部署平台从 Railway 更新为 Render，更新部署规范

### Migration
- feat: migrate ai-service deployment from Railway to Render (render.yaml, smoke updated)

