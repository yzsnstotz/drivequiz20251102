BEGIN;
UPDATE questions AS q
SET license_type_tag = qd.license_type_tag
FROM questions_duplicate AS qd
WHERE q.content_hash = qd.content_hash
AND (q.license_type_tag IS DISTINCT FROM qd.license_type_tag);
COMMIT;

