ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "seo_title" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "seo_description" text;
