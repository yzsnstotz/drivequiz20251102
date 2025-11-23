-- ============================================================
-- 添加 partial_success 状态支持
-- 文件名: 20250210_add_partial_success_status.sql
-- 说明: 更新 batch_process_tasks 表的状态字段注释，支持 partial_success 状态
--       用于标识批量处理任务中部分题目数据不完整（缺少语言或 tag）的情况
-- 日期: 2025-02-10
-- 数据库: 主程序数据库（drivequiz）
-- 注意: 此迁移文件必须在主程序数据库中运行
-- ============================================================

BEGIN;

-- ============================================================
-- 更新 batch_process_tasks 表的 status 字段注释
-- ============================================================
COMMENT ON COLUMN batch_process_tasks.status IS '任务状态：pending(待处理), processing(处理中), completed(已完成-完全成功), partial_success(部分成功-数据不完整), failed(失败), cancelled(已取消)';

COMMIT;

