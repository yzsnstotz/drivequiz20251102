-- 创建激活记录表
CREATE TABLE IF NOT EXISTS activations (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    activation_code VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建激活码表
CREATE TABLE IF NOT EXISTS activation_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    is_used BOOLEAN DEFAULT FALSE,
    usage_limit INTEGER DEFAULT 1,
    used_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- 插入一些测试数据（可选）
-- INSERT INTO activations (email, activation_code, ip_address, user_agent)
-- VALUES ('test@example.com', 'VALID-ACTIVATION-CODE-12345', '127.0.0.1', 'Mozilla/5.0...');

-- 查询激活记录示例
-- SELECT * FROM activations;