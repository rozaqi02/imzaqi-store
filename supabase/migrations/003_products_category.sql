-- Product category for catalog filters / admin
-- Allowed keys: streaming | music | tools | ai | design | learning | other
--
-- Apply this entire script in Supabase → SQL Editor → Run
-- Fixes 400 Bad Request when saving category "ai" or "design"
-- (usually caused by an old ENUM / CHECK that only allows the original 5 values).

-- 1) Ensure column exists as free-form text (or convert from enum)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'category'
  ) THEN
    -- If category is an enum (or domain), cast to text first
    BEGIN
      ALTER TABLE public.products
        ALTER COLUMN category TYPE text
        USING category::text;
    EXCEPTION
      WHEN others THEN
        -- Already text or incompatible; ignore
        NULL;
    END;
  ELSE
    ALTER TABLE public.products
      ADD COLUMN category text;
  END IF;
END $$;

-- 2) Drop any CHECK constraints on products that mention category
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'products'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE public.products DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- 3) Normalize empty values
UPDATE public.products
SET category = 'other'
WHERE category IS NULL OR btrim(category) = '';

-- 4) Optional index for filter counts
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products (category);

-- 5) Loose check that includes AI + Design (optional safety net)
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_category_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_category_check
  CHECK (
    category IS NULL
    OR category IN (
      'streaming',
      'music',
      'tools',
      'ai',
      'design',
      'learning',
      'other'
    )
  );

COMMENT ON COLUMN public.products.category IS
  'Catalog category key: streaming | music | tools | ai | design | learning | other';
