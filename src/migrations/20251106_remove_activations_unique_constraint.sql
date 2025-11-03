-- ============================================================
-- 迁移脚本: 移除 activations 表的 activation_code UNIQUE 约束
-- 日期: 2025-11-06
-- 原因: 允许同一个激活码被多个邮箱使用（只要不超过使用次数限制）
-- ============================================================

-- 注意: 需要先找到约束名称，然后删除
-- PostgreSQL 中可以通过以下查询找到约束名称:
-- SELECT constraint_name 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'activations' 
--   AND constraint_type = 'UNIQUE'
--   AND constraint_name LIKE '%activation_code%';

-- 方法1: 如果知道约束名称（常见名称）
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- 查找 activations 表中 activation_code 字段的 UNIQUE 约束
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = 'activations'
      AND tc.constraint_type = 'UNIQUE'
      AND kcu.column_name = 'activation_code'
    LIMIT 1;
    
    -- 如果找到约束，删除它
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE activations DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_name);
        RAISE NOTICE '已删除约束: %', constraint_name;
    ELSE
        RAISE NOTICE '未找到 activation_code 的 UNIQUE 约束，可能已被删除或不存在';
    END IF;
END $$;

-- 方法2: 如果约束名称是标准的（activations_activation_code_key 或类似）
-- 可以尝试直接删除（如果方法1没有成功）
ALTER TABLE activations DROP CONSTRAINT IF EXISTS activations_activation_code_key;
ALTER TABLE activations DROP CONSTRAINT IF EXISTS activations_activation_code_unique;
ALTER TABLE activations DROP CONSTRAINT IF EXISTS activation_code_unique;

-- 验证约束是否已删除
-- 可以通过以下查询验证:
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 'activations' AND constraint_type = 'UNIQUE';

