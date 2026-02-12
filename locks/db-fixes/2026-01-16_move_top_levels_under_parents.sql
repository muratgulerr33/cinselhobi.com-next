-- ============================================
-- Forward Fix: Move 4 top-level categories under parents
-- Date: 2026-01-16
-- ============================================
-- 
-- Purpose: 
--   - Reduce top-level categories from 9 to 5
--   - Move categories to appropriate parents:
--     1. anal-oyuncaklar -> parent sex-oyuncaklari
--     2. kayganlastirici-jeller -> parent kozmetik
--     3. geciktiriciler -> parent erkeklere-ozel
--     4. realistik-mankenler -> parent erkeklere-ozel
-- 
-- Expected Result:
--   - Top-level count: 5 (erkeklere-ozel, kadinlara-ozel, sex-oyuncaklari, kozmetik, fantezi-aksesuarlar)
--
-- ============================================

BEGIN;

-- Fail-fast: Check that all required slugs exist
DO $$
DECLARE
  missing_slugs TEXT[];
BEGIN
  SELECT ARRAY_AGG(slug) INTO missing_slugs
  FROM (
    VALUES 
      ('anal-oyuncaklar'),
      ('kayganlastirici-jeller'),
      ('geciktiriciler'),
      ('realistik-mankenler'),
      ('sex-oyuncaklari'),
      ('kozmetik'),
      ('erkeklere-ozel')
  ) AS required(slug)
  WHERE NOT EXISTS (
    SELECT 1 FROM categories WHERE slug = required.slug
  );
  
  IF missing_slugs IS NOT NULL AND array_length(missing_slugs, 1) > 0 THEN
    RAISE EXCEPTION 'Missing required categories: %', array_to_string(missing_slugs, ', ');
  END IF;
END $$;

-- Step 1: Move anal-oyuncaklar under sex-oyuncaklari
UPDATE categories
SET parent_wc_id = (SELECT wc_id FROM categories WHERE slug = 'sex-oyuncaklari')
WHERE slug = 'anal-oyuncaklar'
  AND parent_wc_id IS NULL;

-- Step 2: Move kayganlastirici-jeller under kozmetik
UPDATE categories
SET parent_wc_id = (SELECT wc_id FROM categories WHERE slug = 'kozmetik')
WHERE slug = 'kayganlastirici-jeller'
  AND parent_wc_id IS NULL;

-- Step 3: Move geciktiriciler under erkeklere-ozel
UPDATE categories
SET parent_wc_id = (SELECT wc_id FROM categories WHERE slug = 'erkeklere-ozel')
WHERE slug = 'geciktiriciler'
  AND parent_wc_id IS NULL;

-- Step 4: Move realistik-mankenler under erkeklere-ozel
UPDATE categories
SET parent_wc_id = (SELECT wc_id FROM categories WHERE slug = 'erkeklere-ozel')
WHERE slug = 'realistik-mankenler'
  AND parent_wc_id IS NULL;

COMMIT;

-- ============================================
-- Verification Query (run after applying):
-- ============================================
-- SELECT slug, wc_id, parent_wc_id 
-- FROM categories 
-- WHERE parent_wc_id IS NULL 
-- ORDER BY slug;
-- 
-- Expected result: 5 rows
--   - erkeklere-ozel
--   - kadinlara-ozel
--   - sex-oyuncaklari
--   - kozmetik
--   - fantezi-aksesuarlar
