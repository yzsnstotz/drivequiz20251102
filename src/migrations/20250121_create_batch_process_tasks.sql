-- ============================================================
-- 创建批量处理任务记录表
-- 文件名: 20250121_create_batch_process_tasks.sql
-- 说明: 用于记录批量处理任务的状态和进度
-- 日期: 2025-01-21
-- 数据库: 主程序数据库（drivequiz）
-- 注意: 此迁移文件必须在主程序数据库中运行
-- ============================================================

BEGIN;

-- ============================================================
-- 创建 batch_process_tasks 表
-- ============================================================
CREATE TABLE IF NOT EXISTS batch_process_tasks (
  id BIGSERIAL PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL UNIQUE,              -- 任务唯一标识
  status VARCHAR(20) NOT NULL DEFAULT 'pending',    -- 任务状态：pending, processing, completed, failed, cancelled
  operations TEXT[] NOT NULL,                       -- 要执行的操作列表
  question_ids INTEGER[],                            -- 要处理的题目ID列表（空数组表示全部）
  translate_options JSONB,                          -- 翻译选项
  polish_options JSONB,                             -- 润色选项
  batch_size INTEGER DEFAULT 10,                    -- 每批处理数量
  continue_on_error BOOLEAN DEFAULT TRUE,           -- 遇到错误是否继续
  
  -- 进度统计
  total_questions INTEGER DEFAULT 0,                 -- 总题目数
  processed_count INTEGER DEFAULT 0,                -- 已处理数量
  succeeded_count INTEGER DEFAULT 0,                 -- 成功数量
  failed_count INTEGER DEFAULT 0,                    -- 失败数量
  current_batch INTEGER DEFAULT 0,                  -- 当前批次
  
  -- 结果数据
  errors JSONB,                                      -- 错误列表 [{questionId, error}]
  details JSONB,                                     -- 详细处理结果
  
  -- 元数据
  created_by VARCHAR(64),                           -- 创建者（管理员ID或用户名）
  started_at TIMESTAMPTZ,                           -- 开始时间
  completed_at TIMESTAMPTZ,                         -- 完成时间
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_batch_process_tasks_task_id ON batch_process_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_batch_process_tasks_status ON batch_process_tasks(status);
CREATE INDEX IF NOT EXISTS idx_batch_process_tasks_created_at ON batch_process_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_process_tasks_created_by ON batch_process_tasks(created_by);

-- 添加注释
COMMENT ON TABLE batch_process_tasks IS '批量处理任务记录表';
COMMENT ON COLUMN batch_process_tasks.task_id IS '任务唯一标识';
COMMENT ON COLUMN batch_process_tasks.status IS '任务状态：pending(待处理), processing(处理中), completed(已完成), failed(失败), cancelled(已取消)';
COMMENT ON COLUMN batch_process_tasks.operations IS '要执行的操作列表：translate, polish, fill_missing, category_tags';
COMMENT ON COLUMN batch_process_tasks.question_ids IS '要处理的题目ID列表，空数组表示处理全部题目';
COMMENT ON COLUMN batch_process_tasks.processed_count IS '已处理题目数量';
COMMENT ON COLUMN batch_process_tasks.current_batch IS '当前正在处理的批次号';

COMMIT;

