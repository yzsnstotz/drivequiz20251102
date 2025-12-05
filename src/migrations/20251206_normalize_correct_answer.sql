-- 统一 correct_answer 为 {"type":"boolean","value":true|false}
-- 幂等：仅处理非对象且为布尔/字符串的记录

UPDATE questions
SET correct_answer = jsonb_build_object(
  'type', 'boolean',
  'value', CASE
    WHEN correct_answer = 'true'::jsonb  OR correct_answer = '"true"'::jsonb  THEN true
    WHEN correct_answer = 'false'::jsonb OR correct_answer = '"false"'::jsonb THEN false
    ELSE null
  END
)
WHERE correct_answer IS NOT NULL
  AND jsonb_typeof(correct_answer) IN ('boolean', 'string')
  AND (
    correct_answer = 'true'::jsonb
    OR correct_answer = 'false'::jsonb
    OR correct_answer = '"true"'::jsonb
    OR correct_answer = '"false"'::jsonb
  );
