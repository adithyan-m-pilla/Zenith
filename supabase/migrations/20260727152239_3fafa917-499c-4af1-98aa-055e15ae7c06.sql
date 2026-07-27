CREATE OR REPLACE FUNCTION public.recompute_study_daily_total(_user_id uuid, _study_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  summed_minutes integer;
BEGIN
  SELECT COALESCE(LEAST(1440, SUM(duration_minutes)::integer), 0)
  INTO summed_minutes
  FROM public.study_sessions
  WHERE user_id = _user_id
    AND local_date = _study_date
    AND duration_minutes >= 0
    AND duration_minutes <= 1440;

  IF summed_minutes <= 0 THEN
    DELETE FROM public.study_daily_totals
    WHERE user_id = _user_id AND study_date = _study_date;
    RETURN;
  END IF;

  INSERT INTO public.study_daily_totals (user_id, study_date, total_minutes)
  VALUES (_user_id, _study_date, summed_minutes)
  ON CONFLICT (user_id, study_date)
  DO UPDATE SET
    total_minutes = EXCLUDED.total_minutes,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_study_daily_total(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_study_daily_total(uuid, date) FROM anon;
REVOKE ALL ON FUNCTION public.recompute_study_daily_total(uuid, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_study_daily_total(uuid, date) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_study_daily_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_date date;
  old_date date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_date := COALESCE(OLD.local_date, (OLD.completed_at AT TIME ZONE 'UTC')::date, CURRENT_DATE);
    PERFORM public.recompute_study_daily_total(OLD.user_id, old_date);
    RETURN OLD;
  END IF;

  NEW.local_date := COALESCE(NEW.local_date, (NEW.completed_at AT TIME ZONE 'UTC')::date, CURRENT_DATE);
  new_date := NEW.local_date;

  IF TG_OP = 'UPDATE' THEN
    old_date := COALESCE(OLD.local_date, (OLD.completed_at AT TIME ZONE 'UTC')::date, CURRENT_DATE);
    IF OLD.user_id <> NEW.user_id OR old_date <> new_date THEN
      PERFORM public.recompute_study_daily_total(OLD.user_id, old_date);
    END IF;
  END IF;

  PERFORM public.recompute_study_daily_total(NEW.user_id, new_date);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_study_daily_total() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_study_daily_total() FROM anon;
REVOKE ALL ON FUNCTION public.sync_study_daily_total() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_study_daily_total() TO service_role;

DROP TRIGGER IF EXISTS sync_study_daily_total_after_insert ON public.study_sessions;
DROP TRIGGER IF EXISTS sync_study_daily_total_after_change ON public.study_sessions;
CREATE TRIGGER sync_study_daily_total_after_change
AFTER INSERT OR UPDATE OR DELETE ON public.study_sessions
FOR EACH ROW
EXECUTE FUNCTION public.sync_study_daily_total();

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