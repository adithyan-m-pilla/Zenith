DROP POLICY IF EXISTS "Users can insert own daily totals" ON public.study_daily_totals;
DROP POLICY IF EXISTS "Users can update own daily totals" ON public.study_daily_totals;

REVOKE INSERT, UPDATE, DELETE ON public.study_daily_totals FROM authenticated;
GRANT SELECT ON public.study_daily_totals TO authenticated;
GRANT ALL ON public.study_daily_totals TO service_role;