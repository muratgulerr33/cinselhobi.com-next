-- ============================================
-- Forward Fix: Move manken to realistik-mankenler
-- Date: 2026-01-15
-- Product: yarim-vucut-mega-boy-ultra-realistik-manken
-- ============================================
-- 
-- Purpose: 
--   - Move product from et-dokulu-urunler to realistik-mankenler
--   - Remove sex-oyuncaklari link (multiTopLevel rule violation)
-- 
-- Changes:
--   1. Remove link: et-dokulu-urunler
--   2. Add link: realistik-mankenler
--   3. Remove link: sex-oyuncaklari
--
-- ============================================

BEGIN;

-- Step 1: Remove et-dokulu-urunler link
DELETE FROM product_categories
WHERE product_id = (SELECT id FROM products WHERE slug = 'yarim-vucut-mega-boy-ultra-realistik-manken')
  AND category_id = (SELECT id FROM categories WHERE slug = 'et-dokulu-urunler');

-- Step 2: Add realistik-mankenler link
INSERT INTO product_categories (product_id, category_id)
SELECT 
  (SELECT id FROM products WHERE slug = 'yarim-vucut-mega-boy-ultra-realistik-manken'),
  (SELECT id FROM categories WHERE slug = 'realistik-mankenler')
WHERE NOT EXISTS (
  SELECT 1 FROM product_categories
  WHERE product_id = (SELECT id FROM products WHERE slug = 'yarim-vucut-mega-boy-ultra-realistik-manken')
    AND category_id = (SELECT id FROM categories WHERE slug = 'realistik-mankenler')
);

-- Step 3: Remove sex-oyuncaklari link (multiTopLevel rule)
DELETE FROM product_categories
WHERE product_id = (SELECT id FROM products WHERE slug = 'yarim-vucut-mega-boy-ultra-realistik-manken')
  AND category_id = (SELECT id FROM categories WHERE slug = 'sex-oyuncaklari');

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
