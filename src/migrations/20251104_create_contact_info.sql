-- 联系信息表（用于商务合作、激活码购买等）
CREATE TABLE IF NOT EXISTS contact_info (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL CHECK (type IN ('business', 'purchase')),
  wechat VARCHAR(100),
  email VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 服务条款表
CREATE TABLE IF NOT EXISTS terms_of_service (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  version VARCHAR(50) DEFAULT '1.0',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_contact_info_type ON contact_info(type);
CREATE INDEX IF NOT EXISTS idx_contact_info_status ON contact_info(status);
CREATE INDEX IF NOT EXISTS idx_terms_of_service_status ON terms_of_service(status);

