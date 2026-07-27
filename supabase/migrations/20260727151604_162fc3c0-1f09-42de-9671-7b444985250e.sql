DELETE FROM public.study_sessions
WHERE duration_minutes > 1440 OR duration_minutes < 0;

ALTER TABLE public.study_sessions
DROP CONSTRAINT IF EXISTS study_sessions_duration_minutes_sane;

ALTER TABLE public.study_sessions
ADD CONSTRAINT study_sessions_duration_minutes_sane
CHECK (duration_minutes >= 0 AND duration_minutes <= 1440);