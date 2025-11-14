-- ============================================================
-- 重置表 ID 序列从头开始计数
-- 文件名: 20250122_reset_id_sequences.sql
-- 说明: 
--   1. 重置指定表的 ID 序列，使下一个插入的 ID 从 1 开始
--   2. 注意：此操作会清空表数据或重置序列，请谨慎使用
--   3. 如果表中有数据，序列会设置为当前最大 ID + 1
-- 日期: 2025-01-22
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 方法 1: 重置序列为 1（适用于已清空数据的表）
-- ============================================================
-- 使用示例：
-- SELECT setval('questions_id_seq', 1, false);  -- 重置为 1，下次插入从 1 开始
-- SELECT setval('users_id_seq', 1, false);
-- SELECT setval('ai_logs_id_seq', 1, false);

-- ============================================================
-- 方法 2: 重置序列为当前最大 ID + 1（保留现有数据）
-- ============================================================
-- 使用示例：
-- SELECT setval('questions_id_seq', COALESCE((SELECT MAX(id) FROM questions), 0) + 1, false);
-- SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 0) + 1, false);
-- SELECT setval('ai_logs_id_seq', COALESCE((SELECT MAX(id) FROM ai_logs), 0) + 1, false);

-- ============================================================
-- 通用函数：自动重置指定表的 ID 序列
-- ============================================================
CREATE OR REPLACE FUNCTION reset_table_id_sequence(
  table_name TEXT,
  reset_to_one BOOLEAN DEFAULT false
) RETURNS void AS $$
DECLARE
  seq_name TEXT;
  max_id BIGINT;
  sql_text TEXT;
BEGIN
  -- 查找序列名称（通常是 表名_id_seq）
  SELECT pg_get_serial_sequence(table_name, 'id') INTO seq_name;
  
  IF seq_name IS NULL THEN
    RAISE EXCEPTION '表 % 没有找到 id 序列', table_name;
  END IF;
  
  IF reset_to_one THEN
    -- 重置为 1（适用于已清空数据的表）
    sql_text := format('SELECT setval(%L, 1, false)', seq_name);
    EXECUTE sql_text;
    RAISE NOTICE '已将表 % 的序列 % 重置为 1', table_name, seq_name;
  ELSE
    -- 重置为当前最大 ID + 1（保留现有数据）
    sql_text := format('SELECT COALESCE((SELECT MAX(id) FROM %I), 0)', table_name);
    EXECUTE sql_text INTO max_id;
    
    sql_text := format('SELECT setval(%L, %s, false)', seq_name, max_id + 1);
    EXECUTE sql_text;
    RAISE NOTICE '已将表 % 的序列 % 重置为 %', table_name, seq_name, max_id + 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 使用示例
-- ============================================================
-- 重置为 1（表已清空）：
-- SELECT reset_table_id_sequence('questions', true);
-- SELECT reset_table_id_sequence('users', true);
-- SELECT reset_table_id_sequence('ai_logs', true);

-- 重置为当前最大 ID + 1（保留数据）：
-- SELECT reset_table_id_sequence('questions', false);
-- SELECT reset_table_id_sequence('users', false);
-- SELECT reset_table_id_sequence('ai_logs', false);

-- ============================================================
-- 批量重置多个表的序列（根据实际需要修改）
-- ============================================================
-- 如果需要重置多个表，可以取消下面的注释并执行：

-- 重置为 1（表已清空）：
-- SELECT reset_table_id_sequence('questions', true);
-- SELECT reset_table_id_sequence('users', true);
-- SELECT reset_table_id_sequence('ai_logs', true);
-- SELECT reset_table_id_sequence('admins', true);
-- SELECT reset_table_id_sequence('vehicles', true);
-- SELECT reset_table_id_sequence('operation_logs', true);

-- 重置为当前最大 ID + 1（保留数据）：
-- SELECT reset_table_id_sequence('questions', false);
-- SELECT reset_table_id_sequence('users', false);
-- SELECT reset_table_id_sequence('ai_logs', false);
-- SELECT reset_table_id_sequence('admins', false);
-- SELECT reset_table_id_sequence('vehicles', false);
-- SELECT reset_table_id_sequence('operation_logs', false);

COMMIT;

-- ============================================================
-- 回滚脚本（DOWN）
-- ============================================================
-- 如果需要回滚，执行以下SQL：
-- DROP FUNCTION IF EXISTS reset_table_id_sequence(TEXT, BOOLEAN);

