-- ============================================================
-- 为首页 Banner 接入广告管理体系
-- 1) 确保 ad_slots 存在 home_banner 广告位
-- 2) 预置四条多语言广告内容（沿用原首页硬编码文案）
-- ============================================================

BEGIN;

-- 1) 确保广告位存在
INSERT INTO ad_slots (position, name, name_zh, name_en, name_ja, description, format, status, created_at, updated_at)
VALUES (
  'home_banner',
  'Home Banner',
  '首页顶部横幅',
  'Home Banner',
  'ホームバナー',
  '首页顶部横幅广告位',
  'banner',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (position) DO UPDATE
SET
  name = EXCLUDED.name,
  name_zh = EXCLUDED.name_zh,
  name_en = EXCLUDED.name_en,
  name_ja = EXCLUDED.name_ja,
  description = EXCLUDED.description,
  format = EXCLUDED.format,
  status = EXCLUDED.status,
  updated_at = NOW();

-- 2) 预置广告内容（仅在不存在时插入）
WITH slot AS (
  SELECT id FROM ad_slots WHERE position = 'home_banner' LIMIT 1
), seed AS (
  SELECT *
  FROM (VALUES
    ( '平台介绍'
    , ''
    , ''
    , 'https://raw.githubusercontent.com/yzsnstotz/drivequiz-experiment/refs/heads/main/image/banner/intro.webp'
    , 'https://zalem-app.gitbook.io/info/intro'
    , 4, 1 ),
    ( '“大乱斗”挑战赛火热开启中'
    , ''
    , ''
    , 'https://raw.githubusercontent.com/yzsnstotz/drivequiz-experiment/refs/heads/main/image/banner/royalbattlecompetition.webp'
    , 'https://zalem-app.gitbook.io/info/event/royalbattle'
    , 3, 1 ),
    ( '新！志愿者招募计划开启！'
    , ''
    , ''
    , 'https://raw.githubusercontent.com/yzsnstotz/drivequiz-experiment/refs/heads/main/image/banner/volunteerreruitmentevent.webp'
    , 'https://zalem-app.gitbook.io/info/event/volunteer-recruit'
    , 2, 1 ),
    ( '新！商家入驻计划开启！'
    , ''
    , ''
    , 'https://raw.githubusercontent.com/yzsnstotz/drivequiz-experiment/refs/heads/main/image/banner/merchantrecruitevent.webp'
    , 'https://zalem-app.gitbook.io/info/event/merchant-recruit'
    , 1, 1 )
  ) AS t(title_zh, title_en, title_ja, image_url, link_url, priority, weight)
)
INSERT INTO ad_contents (
  slot_id,
  title, title_zh, title_en, title_ja,
  description, description_zh, description_en, description_ja,
  image_url,
  video_url,
  link_url,
  start_date,
  end_date,
  priority,
  weight,
  status,
  created_at,
  updated_at
)
SELECT
  slot.id,
  COALESCE(s.title_zh, s.title_en, s.title_ja, ''),
  NULLIF(s.title_zh, ''),
  NULLIF(s.title_en, ''),
  NULLIF(s.title_ja, ''),
  NULL, NULL, NULL, NULL,
  s.image_url,
  NULL,
  s.link_url,
  NULL,
  NULL,
  s.priority,
  s.weight,
  'active',
  NOW(),
  NOW()
FROM seed s
CROSS JOIN slot
WHERE NOT EXISTS (
  SELECT 1 FROM ad_contents c
  WHERE c.slot_id = slot.id
    AND c.image_url = s.image_url
    AND c.link_url = s.link_url
);

COMMIT;

