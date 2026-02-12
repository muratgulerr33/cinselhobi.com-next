-- ============================================
-- Rollback Fix: Restore 4 categories to top-level
-- Date: 2026-01-16
-- ============================================
-- 
-- Purpose: 
--   - Rollback the move of 4 categories back to top-level
--   - Only rollback if current parent matches expected parent
-- 
-- Categories to restore:
--   1. anal-oyuncaklar (was under sex-oyuncaklari)
--   2. kayganlastirici-jeller (was under kozmetik)
--   3. geciktiriciler (was under erkeklere-ozel)
--   4. realistik-mankenler (was under erkeklere-ozel)
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

-- Step 1: Restore anal-oyuncaklar to top-level (only if parent is sex-oyuncaklari)
UPDATE categories
SET parent_wc_id = NULL
WHERE slug = 'anal-oyuncaklar'
  AND parent_wc_id = (SELECT wc_id FROM categories WHERE slug = 'sex-oyuncaklari');

-- Step 2: Restore kayganlastirici-jeller to top-level (only if parent is kozmetik)
UPDATE categories
SET parent_wc_id = NULL
WHERE slug = 'kayganlastirici-jeller'
  AND parent_wc_id = (SELECT wc_id FROM categories WHERE slug = 'kozmetik');

-- Step 3: Restore geciktiriciler to top-level (only if parent is erkeklere-ozel)
UPDATE categories
SET parent_wc_id = NULL
WHERE slug = 'geciktiriciler'
  AND parent_wc_id = (SELECT wc_id FROM categories WHERE slug = 'erkeklere-ozel');

-- Step 4: Restore realistik-mankenler to top-level (only if parent is erkeklere-ozel)
UPDATE categories
SET parent_wc_id = NULL
WHERE slug = 'realistik-mankenler'
  AND parent_wc_id = (SELECT wc_id FROM categories WHERE slug = 'erkeklere-ozel');

COMMIT;

-- ============================================
-- Verification Query (run after rollback):
-- ============================================
-- SELECT slug, wc_id, parent_wc_id 
-- FROM categories 
-- WHERE parent_wc_id IS NULL 
-- ORDER BY slug;
-- 
-- Expected result: 9 rows (original state)
