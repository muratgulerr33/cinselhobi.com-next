-- ============================================
-- Rollback Fix: Restore manken to original categories
-- Date: 2026-01-15
-- Product: yarim-vucut-mega-boy-ultra-realistik-manken
-- ============================================
-- 
-- Purpose: 
--   - Rollback the forward fix
--   - Restore original category links
-- 
-- Changes:
--   1. Remove link: realistik-mankenler
--   2. Add link: et-dokulu-urunler
--   3. Add link: sex-oyuncaklari
--
-- ============================================

BEGIN;

-- Step 1: Remove realistik-mankenler link
DELETE FROM product_categories
WHERE product_id = (SELECT id FROM products WHERE slug = 'yarim-vucut-mega-boy-ultra-realistik-manken')
  AND category_id = (SELECT id FROM categories WHERE slug = 'realistik-mankenler');

-- Step 2: Add et-dokulu-urunler link (restore)
INSERT INTO product_categories (product_id, category_id)
SELECT 
  (SELECT id FROM products WHERE slug = 'yarim-vucut-mega-boy-ultra-realistik-manken'),
  (SELECT id FROM categories WHERE slug = 'et-dokulu-urunler')
WHERE NOT EXISTS (
  SELECT 1 FROM product_categories
  WHERE product_id = (SELECT id FROM products WHERE slug = 'yarim-vucut-mega-boy-ultra-realistik-manken')
    AND category_id = (SELECT id FROM categories WHERE slug = 'et-dokulu-urunler')
);

-- Step 3: Add sex-oyuncaklari link (restore)
INSERT INTO product_categories (product_id, category_id)
SELECT 
  (SELECT id FROM products WHERE slug = 'yarim-vucut-mega-boy-ultra-realistik-manken'),
  (SELECT id FROM categories WHERE slug = 'sex-oyuncaklari')
WHERE NOT EXISTS (
  SELECT 1 FROM product_categories
  WHERE product_id = (SELECT id FROM products WHERE slug = 'yarim-vucut-mega-boy-ultra-realistik-manken')
    AND category_id = (SELECT id FROM categories WHERE slug = 'sex-oyuncaklari')
);

COMMIT;

-- ============================================
-- Verification Query (run after applying):
-- ============================================
-- SELECT 
--   p.slug as product_slug,
--   p.name as product_name,
--   c.slug as category_slug,
--   c.name as category_name
-- FROM products p
-- JOIN product_categories pc ON p.id = pc.product_id
-- JOIN categories c ON pc.category_id = c.id
-- WHERE p.slug = 'yarim-vucut-mega-boy-ultra-realistik-manken'
-- ORDER BY c.slug;
