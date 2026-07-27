ALTER TABLE public.study_sessions
ADD COLUMN IF NOT EXISTS local_date date;

UPDATE public.study_sessions
SET local_date = (completed_at AT TIME ZONE 'UTC')::date
WHERE local_date IS NULL;

ALTER TABLE public.study_sessions
ALTER COLUMN local_date SET DEFAULT CURRENT_DATE;

CREATE TABLE IF NOT EXISTS public.study_daily_totals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  study_date date NOT NULL,
  total_minutes integer NOT NULL DEFAULT 0 CHECK (total_minutes >= 0 AND total_minutes <= 1440),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, study_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_daily_totals TO authenticated;
GRANT ALL ON public.study_daily_totals TO service_role;

ALTER TABLE public.study_daily_totals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own and friends daily totals" ON public.study_daily_totals;
CREATE POLICY "Users can view own and friends daily totals"
ON public.study_daily_totals
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.requester_id = auth.uid() AND f.addressee_id = study_daily_totals.user_id)
        OR (f.addressee_id = auth.uid() AND f.requester_id = study_daily_totals.user_id)
      )
  )
);

DROP POLICY IF EXISTS "Users can insert own daily totals" ON public.study_daily_totals;
CREATE POLICY "Users can insert own daily totals"
ON public.study_daily_totals
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own daily totals" ON public.study_daily_totals;
CREATE POLICY "Users can update own daily totals"
ON public.study_daily_totals
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_study_daily_totals_user_date
ON public.study_daily_totals (user_id, study_date DESC);

DROP TRIGGER IF EXISTS update_study_daily_totals_updated_at ON public.study_daily_totals;
CREATE TRIGGER update_study_daily_totals_updated_at
BEFORE UPDATE ON public.study_daily_totals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.study_daily_totals (user_id, study_date, total_minutes)
SELECT user_id, local_date, LEAST(1440, SUM(duration_minutes)::integer) AS total_minutes
FROM public.study_sessions
WHERE local_date IS NOT NULL
  AND duration_minutes >= 0
  AND duration_minutes <= 1440
GROUP BY user_id, local_date
ON CONFLICT (user_id, study_date)
DO UPDATE SET
  total_minutes = EXCLUDED.total_minutes,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.sync_study_daily_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_date date;
  safe_minutes integer;
BEGIN
  target_date := COALESCE(NEW.local_date, (NEW.completed_at AT TIME ZONE 'UTC')::date, CURRENT_DATE);
  safe_minutes := LEAST(1440, GREATEST(0, FLOOR(NEW.duration_minutes)::integer));

  IF safe_minutes <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.study_daily_totals (user_id, study_date, total_minutes)
  VALUES (NEW.user_id, target_date, safe_minutes)
  ON CONFLICT (user_id, study_date)
  DO UPDATE SET
    total_minutes = LEAST(1440, public.study_daily_totals.total_minutes + EXCLUDED.total_minutes),
    updated_at = now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_study_daily_total() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_study_daily_total() FROM anon;
REVOKE ALL ON FUNCTION public.sync_study_daily_total() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_study_daily_total() TO service_role;

DROP TRIGGER IF EXISTS sync_study_daily_total_after_insert ON public.study_sessions;
CREATE TRIGGER sync_study_daily_total_after_insert
AFTER INSERT ON public.study_sessions
FOR EACH ROW
EXECUTE FUNCTION public.sync_study_daily_total();