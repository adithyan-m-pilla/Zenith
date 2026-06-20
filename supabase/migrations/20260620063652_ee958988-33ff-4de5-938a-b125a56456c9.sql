ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_studying boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS studying_since timestamptz;