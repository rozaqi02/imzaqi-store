-- ============================================================================
-- Migration 0010: Kategori & relasi produk opsional pada public.testimonials
--
-- Tujuan:
--   Memungkinkan setiap foto testimoni dikelompokkan berdasarkan produk
--   dan/atau kategori paket produk (opsional / boleh NULL), tanpa mewajibkan
--   caption.
--
-- Aman & idempotent dijalankan di Supabase SQL Editor.
-- ============================================================================

ALTER TABLE public.testimonials
  ADD COLUMN IF NOT EXISTS product_id uuid NULL,
  ADD COLUMN IF NOT EXISTS category text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'testimonials_product_id_fkey'
       AND conrelid = 'public.testimonials'::regclass
  ) THEN
    ALTER TABLE public.testimonials
      ADD CONSTRAINT testimonials_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.testimonials DROP CONSTRAINT IF EXISTS testimonials_category_check;
ALTER TABLE public.testimonials ADD CONSTRAINT testimonials_category_check
  CHECK (
    category IS NULL
    OR category = ANY (
      ARRAY['streaming'::text, 'music'::text, 'tools'::text, 'ai'::text, 'design'::text, 'learning'::text, 'academic'::text, 'other'::text]
    )
  );

CREATE INDEX IF NOT EXISTS idx_testimonials_category_active_sort
  ON public.testimonials (category, is_active, sort_order, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_testimonials_product_id
  ON public.testimonials (product_id)
  WHERE product_id IS NOT NULL;
