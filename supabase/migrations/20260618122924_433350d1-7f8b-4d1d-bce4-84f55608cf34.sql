
-- Add username and invite_code to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS invite_code text;

-- Unique case-insensitive username
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx ON public.profiles (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS profiles_invite_code_idx ON public.profiles (invite_code);

-- Backfill invite codes for existing users
UPDATE public.profiles
SET invite_code = encode(gen_random_bytes(6), 'hex')
WHERE invite_code IS NULL;

-- Allow authenticated users to read minimal profile info of others (for friend search/leaderboard)
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Update handle_new_user to generate invite code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, invite_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    encode(gen_random_bytes(6), 'hex')
  );
  RETURN NEW;
END;
$$;

-- Friendships table
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_no_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friendships_unique_pair UNIQUE (requester_id, addressee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their friendships"
ON public.friendships FOR SELECT TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users send friend requests"
ON public.friendships FOR INSERT TO authenticated
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Addressee can accept, either can update"
ON public.friendships FOR UPDATE TO authenticated
USING (auth.uid() = addressee_id OR auth.uid() = requester_id)
WITH CHECK (auth.uid() = addressee_id OR auth.uid() = requester_id);

CREATE POLICY "Either party can delete"
ON public.friendships FOR DELETE TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE TRIGGER friendships_updated_at
BEFORE UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Allow friends to view each other's study_sessions for leaderboard
DROP POLICY IF EXISTS "Friends can view sessions" ON public.study_sessions;
CREATE POLICY "Friends can view sessions"
ON public.study_sessions FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = auth.uid() AND f.addressee_id = study_sessions.user_id)
        OR (f.addressee_id = auth.uid() AND f.requester_id = study_sessions.user_id))
  )
);
