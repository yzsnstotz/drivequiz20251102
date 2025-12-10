-- ============================================================
-- 创建 student_verifications 表（学生免费 AI 激活申请）
-- 日期: 2025-12-10
-- 数据库: drivequiz 主库
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS student_verifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id),
  full_name         text NOT NULL,
  nationality       text NOT NULL,
  email             text NOT NULL,
  phone_number      text NOT NULL,
  channel_source    text NOT NULL,
  school_name       text NOT NULL,
  study_period_from date,
  study_period_to   date,
  admission_docs    jsonb NOT NULL,
  status            text NOT NULL,
  review_note       text,
  reviewer_id       uuid,
  reviewed_at       timestamptz,
  valid_from        timestamptz,
  valid_until       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_verifications_user_id ON student_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_student_verifications_status ON student_verifications(status);
CREATE INDEX IF NOT EXISTS idx_student_verifications_created_at ON student_verifications(created_at);

COMMENT ON TABLE student_verifications IS '学生免费 AI 激活申请记录';

COMMIT;
