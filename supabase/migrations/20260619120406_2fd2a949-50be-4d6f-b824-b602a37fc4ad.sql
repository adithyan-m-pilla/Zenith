CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, invite_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    replace(gen_random_uuid()::text, '-', '')
  );
  RETURN NEW;
END;
$$;

UPDATE public.profiles
SET invite_code = replace(gen_random_uuid()::text, '-', '')
WHERE invite_code IS NULL;